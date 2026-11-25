import json
import time
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from ultralytics import YOLO

from preprocess import (
    ClaheMode,
    compute_homography_matrices,
    decode_image_bgr,
    detect_rectified_rail_peaks,
    detect_shelf_bays_classical,
    encode_jpeg_data_url,
    enhance_with_roi_stats,
    order_quad_points,
    project_points,
    rect_box_to_camera_poly,
    resize_max_side,
)

BASE_DIR = Path(__file__).resolve().parent
PRODUCT_MODEL_PATH = BASE_DIR / "best_sku110k_yolo11s_960.pt"
SHELF_POSE_MODEL_PATH = BASE_DIR / "best_shelf_quad_yolo11n.pt"
RAKTEST_DIR = BASE_DIR.parents[1] / "raktest"

MODEL_LABEL = "YOLO11s-SKU110K@960"
IMGSZ = 960
DEFAULT_CONF = 0.25
IOU = 0.5
MAX_DET = 1000
ROW_TOLERANCE = 0.64
ROW_MERGE_TOL = 0.80
MIN_ROW_PRODUCTS = 3
GAP_FACTOR = 0.95

STORE_PRESETS = [
    {
        "id": "cam-01",
        "code": "CAM-01",
        "name": "Endcap Susu & Kebutuhan Rumah",
        "scenario": "Sudut Tinggi CCTV (~25°)",
        "angle_note": "Kamera sudut atas menampilkan lantai keramik dan dua lorong samping.",
        "filename": "WhatsApp Image 2026-11-25 at 7.42.46 AM (2).jpeg",
    },
    {
        "id": "cam-02",
        "code": "CAM-02",
        "name": "Endcap Minuman & Tisu",
        "scenario": "Sudut Samping Miring (~20°)",
        "angle_note": "Perspektif miring dengan keranjang kawat samping di tiang kiri.",
        "filename": "WhatsApp Image 2026-11-25 at 7.42.46 AM.jpeg",
    },
    {
        "id": "cam-03",
        "code": "CAM-03",
        "name": "Rak Sabun, Mie & Minuman",
        "scenario": "Bayangan Rak Bawah Gelap",
        "angle_note": "Lampu plafon terang namun baris botol paling bawah tertutup bayangan.",
        "filename": "WhatsApp Image 2026-11-25 at 7.42.47 AM.jpeg",
    },
]

app = FastAPI(title="Rakku CCTV Shelf Intelligence API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

product_model = YOLO(str(PRODUCT_MODEL_PATH))
shelf_pose_model = YOLO(str(SHELF_POSE_MODEL_PATH)) if SHELF_POSE_MODEL_PATH.exists() else None


@app.get("/")
def read_root():
    return {
        "message": "Rakku API aktif",
        "model": MODEL_LABEL,
        "shelf_pose_model": SHELF_POSE_MODEL_PATH.name if shelf_pose_model else "hybrid-lsd-ransac (fallback)",
    }


@app.get("/api/presets")
def list_presets():
    items = []
    for p in STORE_PRESETS:
        img_path = RAKTEST_DIR / p["filename"]
        if img_path.exists():
            items.append(
                {
                    "id": p["id"],
                    "code": p["code"],
                    "name": p["name"],
                    "scenario": p["scenario"],
                    "angle_note": p["angle_note"],
                    "image_url": f"/api/presets/{p['id']}/image",
                }
            )
    return {"presets": items}


@app.get("/api/presets/{preset_id}/image")
def get_preset_image(preset_id: str):
    preset = next((p for p in STORE_PRESETS if p["id"] == preset_id), None)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset kamera tidak ditemukan")
    img_path = RAKTEST_DIR / preset["filename"]
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="File citra preset tidak tersedia")
    return FileResponse(img_path, media_type="image/jpeg")


def _detect_quad_with_pose_model(proc_bgr: np.ndarray) -> tuple[np.ndarray | None, list[dict]]:
    if shelf_pose_model is None:
        return None, []
    res = shelf_pose_model(proc_bgr, imgsz=640, conf=0.35, verbose=False)[0]
    if res.keypoints is None or len(res.keypoints) == 0:
        return None, []

    kpts_all = res.keypoints.xy.cpu().numpy()
    boxes_xyxy = res.boxes.xyxy.cpu().numpy()
    areas = (boxes_xyxy[:, 2] - boxes_xyxy[:, 0]) * (boxes_xyxy[:, 3] - boxes_xyxy[:, 1])
    order = np.argsort(areas)[::-1]

    bays: list[dict] = []
    primary = None
    for rank, idx in enumerate(order, start=1):
        pts = kpts_all[idx]
        if pts.shape[0] >= 4 and float(cv2.contourArea(pts[:4].astype(np.float32))) > 2500.0:
            q = order_quad_points(pts[:4])
            bays.append({"id": rank, "label": f"Rak {rank} (AI Pose)", "quad": q.tolist()})
            if primary is None:
                primary = q
    return primary, bays


def _project_boxes_to_metric_space(
    boxes: np.ndarray,
    confs: np.ndarray,
    h_mat: np.ndarray,
    rect_w: int,
    rect_h: int,
    enforce_roi: bool = True,
) -> tuple[np.ndarray, np.ndarray, int]:
    """
    Map unwarped camera-space product boxes into Metric 2D Shelf Space via H,
    discarding detections outside the shelf polygon and tiny rail price-tags.
    """
    if len(boxes) == 0:
        return np.empty((0, 4), dtype=np.float32), np.empty((0, 4), dtype=np.float32), 0

    xc = 0.5 * (boxes[:, 0] + boxes[:, 2])
    yc = 0.5 * (boxes[:, 1] + boxes[:, 3])
    y_anchor = boxes[:, 1] + 0.78 * (boxes[:, 3] - boxes[:, 1])

    anchors_r = project_points(np.column_stack([xc, y_anchor]), h_mat)
    left_r = project_points(np.column_stack([boxes[:, 0], yc]), h_mat)
    right_r = project_points(np.column_stack([boxes[:, 2], yc]), h_mat)
    top_r = project_points(np.column_stack([xc, boxes[:, 1]]), h_mat)
    bot_r = project_points(np.column_stack([xc, boxes[:, 3]]), h_mat)

    rx1 = np.minimum(left_r[:, 0], right_r[:, 0])
    rx2 = np.maximum(left_r[:, 0], right_r[:, 0])
    ry1 = np.minimum(top_r[:, 1], bot_r[:, 1])
    ry2 = np.maximum(top_r[:, 1], bot_r[:, 1])
    rect_boxes = np.column_stack([rx1, ry1, rx2, ry2]).astype(np.float32)

    if enforce_roi:
        in_roi = (
            (anchors_r[:, 0] >= -0.04 * rect_w)
            & (anchors_r[:, 0] <= 1.04 * rect_w)
            & (anchors_r[:, 1] >= -0.06 * rect_h)
            & (anchors_r[:, 1] <= 1.04 * rect_h)
        )
        boxes = boxes[in_roi]
        rect_boxes = rect_boxes[in_roi]
        confs = confs[in_roi]

    if len(rect_boxes) < 4:
        return boxes, rect_boxes, 0

    rw = rect_boxes[:, 2] - rect_boxes[:, 0]
    rh = rect_boxes[:, 3] - rect_boxes[:, 1]
    med_rw = float(np.median(rw))
    med_rh = float(np.median(rh))

    # Filter small hanging price-tags / promo wobblers along shelf rails
    is_price_tag = (rh < 0.34 * med_rh) & (rw < 0.52 * med_rw) & (confs < 0.48)
    tags_filtered = int(np.sum(is_price_tag))
    keep = ~is_price_tag
    return boxes[keep], rect_boxes[keep], tags_filtered


def _cluster_metric_rows(rect_boxes: np.ndarray) -> list[np.ndarray]:
    """Cluster rows in Metric 2D Shelf Space using shelf-standing base line (y_base)."""
    if len(rect_boxes) == 0:
        return []

    # Weight toward bottom of product (standing on physical shelf board) so tall & short items align
    y_base = rect_boxes[:, 1] + 0.72 * (rect_boxes[:, 3] - rect_boxes[:, 1])
    med_h = max(float(np.median(rect_boxes[:, 3] - rect_boxes[:, 1])), 12.0)
    order = np.argsort(y_base)

    groups: list[list[int]] = []
    current = [int(order[0])]
    for idx in order[1:]:
        idx_i = int(idx)
        if abs(float(y_base[idx_i]) - float(np.mean(y_base[current]))) > ROW_TOLERANCE * med_h:
            groups.append(current)
            current = [idx_i]
        else:
            current.append(idx_i)
    groups.append(current)

    valid = [g for g in groups if len(g) >= MIN_ROW_PRODUCTS]
    if not valid:
        valid = groups

    valid.sort(key=lambda g: float(np.median(y_base[g])))
    merged: list[list[int]] = [valid[0]]
    for g in valid[1:]:
        prev_y = float(np.mean(y_base[merged[-1]]))
        curr_y = float(np.mean(y_base[g]))
        if abs(curr_y - prev_y) < ROW_MERGE_TOL * med_h:
            merged[-1].extend(g)
        else:
            merged.append(g)

    return [np.array(g, dtype=np.int32) for g in merged]


def analyze_metric_shelf(
    cam_boxes: np.ndarray,
    rect_boxes: np.ndarray,
    rect_w: int,
    rect_h: int,
    rail_peaks_norm: list[float],
    h_inv: np.ndarray,
    sx: float,
    sy: float,
) -> tuple[list[dict], list[dict]]:
    """Compute per-row occupancy and empty gaps in Metric 2D Shelf Space, then map back via H_inv."""
    if len(rect_boxes) == 0:
        return [], []

    row_indices_list = _cluster_metric_rows(rect_boxes)
    med_prod_w = max(float(np.median(rect_boxes[:, 2] - rect_boxes[:, 0])), 12.0)
    med_prod_h = max(float(np.median(rect_boxes[:, 3] - rect_boxes[:, 1])), 16.0)

    # Usable horizontal shelf span in metric coordinates (trimming ~2% steel post margin)
    usable_x1 = max(0.015 * rect_w, float(np.percentile(rect_boxes[:, 0], 2)) - 0.35 * med_prod_w)
    usable_x2 = min(0.985 * rect_w, float(np.percentile(rect_boxes[:, 2], 98)) + 0.35 * med_prod_w)
    if usable_x2 - usable_x1 < 0.65 * rect_w:
        usable_x1, usable_x2 = 0.025 * rect_w, 0.975 * rect_w
    shelf_span = max(usable_x2 - usable_x1, 1.0)

    # Build row specifications (including completely empty rows detected between far-apart shelf rails)
    row_specs: list[tuple[np.ndarray | None, float, float]] = []
    for idxs in row_indices_list:
        rb = rect_boxes[idxs]
        ry1 = float(np.clip(np.percentile(rb[:, 1], 10), 0.0, rect_h))
        ry2 = float(np.clip(np.percentile(rb[:, 3], 92), ry1 + 8.0, rect_h))
        if row_specs:
            prev_ry2 = row_specs[-1][2]
            if ry1 - prev_ry2 > 1.75 * med_prod_h:
                mid_rails = [p * rect_h for p in rail_peaks_norm if prev_ry2 + 0.35 * med_prod_h < p * rect_h < ry1 - 0.35 * med_prod_h]
                if mid_rails:
                    row_specs.append((None, prev_ry2 + 6.0, ry1 - 6.0))
        row_specs.append((idxs, ry1, ry2))

    rows_out: list[dict] = []
    gaps_out: list[dict] = []

    for row_num, (idxs, ry1, ry2) in enumerate(row_specs, start=1):
        row_rect_bbox = [round(usable_x1, 1), round(ry1, 1), round(usable_x2, 1), round(ry2, 1)]
        row_poly = rect_box_to_camera_poly(row_rect_bbox, h_inv, sx, sy)
        poly_np = np.array(row_poly, dtype=np.float32)
        cam_bbox = [
            round(float(poly_np[:, 0].min()), 1),
            round(float(poly_np[:, 1].min()), 1),
            round(float(poly_np[:, 0].max()), 1),
            round(float(poly_np[:, 1].max()), 1),
        ]

        if idxs is None or len(idxs) == 0:
            est_slots = max(1, int(round(shelf_span / med_prod_w)))
            gaps_out.append(
                {
                    "row": row_num,
                    "slots": est_slots,
                    "bbox": cam_bbox,
                    "poly": row_poly,
                    "rect_bbox": row_rect_bbox,
                }
            )
            rows_out.append(
                {
                    "id": row_num,
                    "products": 0,
                    "gap": est_slots,
                    "coverage_percent": 0.0,
                    "fill_percent": 0.0,
                    "bbox": cam_bbox,
                    "poly": row_poly,
                    "rect_bbox": row_rect_bbox,
                }
            )
            continue

        rb = rect_boxes[idxs]
        rb = rb[np.argsort(rb[:, 0])]
        row_med_w = max(float(np.median(rb[:, 2] - rb[:, 0])), 0.6 * med_prod_w, 8.0)

        merged_x: list[list[float]] = []
        for x1_raw, x2_raw in zip(rb[:, 0], rb[:, 2]):
            x1 = float(np.clip(x1_raw, usable_x1, usable_x2))
            x2 = float(np.clip(x2_raw, usable_x1, usable_x2))
            if x2 <= x1:
                continue
            if merged_x and x1 <= merged_x[-1][1] + 0.12 * row_med_w:
                merged_x[-1][1] = max(merged_x[-1][1], x2)
            else:
                merged_x.append([x1, x2])

        spans: list[tuple[float, float]] = []
        prev_end = usable_x1
        for sx1, sx2 in merged_x:
            if sx1 > prev_end:
                spans.append((prev_end, sx1))
            prev_end = max(prev_end, sx2)
        if usable_x2 > prev_end:
            spans.append((prev_end, usable_x2))

        gap_slots = 0
        gap_width_sum = 0.0
        for gx1, gx2 in spans:
            gw = gx2 - gx1
            if gw > GAP_FACTOR * row_med_w:
                slots = max(1, int(round(gw / row_med_w)))
                gap_slots += slots
                gap_width_sum += gw
                g_rect = [round(gx1, 1), round(ry1, 1), round(gx2, 1), round(ry2, 1)]
                g_poly = rect_box_to_camera_poly(g_rect, h_inv, sx, sy)
                gp = np.array(g_poly, dtype=np.float32)
                gaps_out.append(
                    {
                        "row": row_num,
                        "slots": slots,
                        "bbox": [
                            round(float(gp[:, 0].min()), 1),
                            round(float(gp[:, 1].min()), 1),
                            round(float(gp[:, 0].max()), 1),
                            round(float(gp[:, 1].max()), 1),
                        ],
                        "poly": g_poly,
                        "rect_bbox": g_rect,
                    }
                )

        occupied_w = max(0.0, shelf_span - gap_width_sum)
        coverage_pct = round(float(np.clip(occupied_w / shelf_span * 100.0, 0.0, 100.0)), 1)
        products_n = int(len(rb))
        slot_pct = round(products_n / (products_n + gap_slots) * 100.0, 1) if (products_n + gap_slots) > 0 else 0.0
        # Coverage width on metric shelf plane is primary; slot ratio smooths single-gap quantization
        fill_pct = round(0.65 * coverage_pct + 0.35 * slot_pct, 1) if gap_slots > 0 else 100.0

        rows_out.append(
            {
                "id": row_num,
                "products": products_n,
                "gap": gap_slots,
                "coverage_percent": coverage_pct,
                "fill_percent": fill_pct,
                "bbox": cam_bbox,
                "poly": row_poly,
                "rect_bbox": row_rect_bbox,
            }
        )

    return rows_out, gaps_out


def process(
    bgr: np.ndarray,
    use_rectify: bool = True,
    use_denoise: bool = True,
    clahe_mode: ClaheMode = "auto",
    conf_threshold: float = DEFAULT_CONF,
    custom_quad_orig: np.ndarray | None = None,
    return_images: bool = True,
) -> dict:
    t_start = time.perf_counter()
    orig_h, orig_w = bgr.shape[:2]
    proc_bgr, _ = resize_max_side(bgr)
    proc_h, proc_w = proc_bgr.shape[:2]
    sx, sy = orig_w / proc_w, orig_h / proc_h

    t_pre0 = time.perf_counter()
    candidate_bays_proc: list[dict] = []

    if not use_rectify:
        quad_proc = np.array([[0, 0], [proc_w, 0], [proc_w, proc_h], [0, proc_h]], dtype=np.float32)
        quad_source = "full_frame"
        detected_deg = 0.0
        candidate_bays_proc = [{"id": 1, "label": "Seluruh Frame", "quad": quad_proc.tolist()}]
    elif custom_quad_orig is not None:
        q_scaled = custom_quad_orig.copy().astype(np.float32)
        q_scaled[:, 0] /= sx
        q_scaled[:, 1] /= sy
        q_scaled[:, 0] = np.clip(q_scaled[:, 0], 0.0, float(proc_w))
        q_scaled[:, 1] = np.clip(q_scaled[:, 1], 0.0, float(proc_h))
        quad_proc = order_quad_points(q_scaled)
        quad_source = "manual_calibration"
        detected_deg = 0.0
        candidate_bays_proc = [{"id": 1, "label": "Zona Kalibrasi Manual", "quad": quad_proc.tolist()}]
    else:
        pose_quad, pose_bays = _detect_quad_with_pose_model(proc_bgr)
        if pose_quad is not None:
            quad_proc = pose_quad
            quad_source = "yolo11n_pose"
            detected_deg = 0.0
            candidate_bays_proc = pose_bays
        else:
            # Fast coarse pass to isolate foreground shelf bay from background aisles before ROI crop
            coarse_res = product_model(proc_bgr, imgsz=640, conf=0.26, iou=IOU, max_det=MAX_DET, verbose=False)[0]
            coarse_boxes = (
                coarse_res.boxes.xyxy.cpu().numpy() if len(coarse_res.boxes) else np.empty((0, 4), dtype=np.float32)
            )
            quad_proc, detected_deg, quad_source, candidate_bays_proc = detect_shelf_bays_classical(
                proc_bgr, coarse_boxes
            )

    enhanced_bgr, enh_meta = enhance_with_roi_stats(
        proc_bgr,
        quad=quad_proc if use_rectify else None,
        use_denoise=use_denoise,
        clahe_mode=clahe_mode,
    )

    h_mat, h_inv, rect_w, rect_h, tilt_deg = compute_homography_matrices(quad_proc)
    angle_deg = max(detected_deg, tilt_deg) if use_rectify else 0.0
    preprocess_ms = round((time.perf_counter() - t_pre0) * 1000.0, 1)

    # Sharp unwarped ROI crop around shelf quad so 3D products suffer zero warp distortion
    t_inf0 = time.perf_counter()
    if use_rectify:
        pad_x = 0.04 * (quad_proc[:, 0].max() - quad_proc[:, 0].min())
        pad_y = 0.04 * (quad_proc[:, 1].max() - quad_proc[:, 1].min())
        cx1 = max(0, int(np.floor(quad_proc[:, 0].min() - pad_x)))
        cy1 = max(0, int(np.floor(quad_proc[:, 1].min() - pad_y)))
        cx2 = min(proc_w, int(np.ceil(quad_proc[:, 0].max() + pad_x)))
        cy2 = min(proc_h, int(np.ceil(quad_proc[:, 1].max() + pad_y)))
        if cx2 - cx1 < 64 or cy2 - cy1 < 64:
            cx1, cy1, cx2, cy2 = 0, 0, proc_w, proc_h
    else:
        cx1, cy1, cx2, cy2 = 0, 0, proc_w, proc_h

    roi_crop = enhanced_bgr[cy1:cy2, cx1:cx2]
    det_res = product_model(
        roi_crop, imgsz=IMGSZ, conf=conf_threshold, iou=IOU, max_det=MAX_DET, verbose=False
    )[0]
    if len(det_res.boxes):
        boxes_proc = det_res.boxes.xyxy.cpu().numpy().copy()
        boxes_proc[:, [0, 2]] += cx1
        boxes_proc[:, [1, 3]] += cy1
        confs = det_res.boxes.conf.cpu().numpy()
    else:
        boxes_proc = np.empty((0, 4), dtype=np.float32)
        confs = np.empty((0,), dtype=np.float32)
    inference_ms = round((time.perf_counter() - t_inf0) * 1000.0, 1)

    # Map detections to Metric 2D Shelf Space via Coordinate-Space Homography
    boxes_proc, rect_boxes, tags_filtered = _project_boxes_to_metric_space(
        boxes_proc, confs, h_mat, rect_w, rect_h, enforce_roi=use_rectify
    )

    planogram_bgr = cv2.warpPerspective(
        enhanced_bgr, h_mat, (rect_w, rect_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT
    )
    rail_peaks = detect_rectified_rail_peaks(planogram_bgr)

    rows, gaps = analyze_metric_shelf(
        boxes_proc, rect_boxes, rect_w, rect_h, rail_peaks, h_inv, sx, sy
    )

    # Scale original-frame boxes, quad, and candidate bays back to full original image pixels
    boxes_orig = boxes_proc.copy()
    if len(boxes_orig):
        boxes_orig[:, [0, 2]] *= sx
        boxes_orig[:, [1, 3]] *= sy

    quad_orig = [[round(float(px * sx), 1), round(float(py * sy), 1)] for px, py in quad_proc]
    candidate_bays_orig = [
        {
            "id": b["id"],
            "label": b["label"],
            "quad": [[round(float(px * sx), 1), round(float(py * sy), 1)] for px, py in b["quad"]],
        }
        for b in candidate_bays_proc
    ]

    total_products = sum(r["products"] for r in rows)
    total_gap = sum(r["gap"] for r in rows)
    total_fill = round(float(np.mean([r["fill_percent"] for r in rows])), 1) if rows else 0.0
    total_ms = round((time.perf_counter() - t_start) * 1000.0, 1)

    payload: dict = {
        "model": MODEL_LABEL,
        "shelf_detector": quad_source,
        "image_width": orig_w,
        "image_height": orig_h,
        "planogram_width": rect_w,
        "planogram_height": rect_h,
        "total_products": total_products,
        "total_gap_slots": total_gap,
        "total_fill": total_fill,
        "price_tags_filtered": tags_filtered,
        "rows": rows,
        "boxes": [[round(float(v), 1) for v in b] for b in boxes_orig],
        "rect_boxes": [[round(float(v), 1) for v in b] for b in rect_boxes],
        "gaps": gaps,
        "candidate_bays": candidate_bays_orig,
        "preprocessing": {
            "orig_size": [orig_w, orig_h],
            "proc_size": [proc_w, proc_h],
            "roi_size": [cx2 - cx1, cy2 - cy1],
            "resized": bool(proc_w != orig_w or proc_h != orig_h),
            "homography_mode": "coordinate_space" if use_rectify else "disabled",
            "quad_source": quad_source,
            "rectify_enabled": bool(use_rectify),
            "rectify_applied": bool(use_rectify),
            "rectify_reason": quad_source if use_rectify else "disabled",
            "rectify_angle_deg": angle_deg,
            "rectify_quad": quad_orig,
            "denoise_applied": enh_meta["denoise_applied"],
            "clahe_mode": enh_meta["clahe_mode"],
            "clahe_applied": enh_meta["clahe_applied"],
            "mean_before": enh_meta["mean_before"],
            "p25_before": enh_meta["p25_before"],
            "mean_after": enh_meta["mean_after"],
            "hist_before": enh_meta["hist_before"],
            "hist_after": enh_meta["hist_after"],
            "rail_peaks_y": rail_peaks,
            "preprocess_ms": preprocess_ms,
            "inference_ms": inference_ms,
            "total_ms": total_ms,
        },
    }
    if return_images:
        payload["preprocessed_image"] = encode_jpeg_data_url(enhanced_bgr)
        payload["planogram_image"] = encode_jpeg_data_url(planogram_bgr)
    return payload


def _parse_custom_quad(raw: str | None) -> np.ndarray | None:
    if not raw or not raw.strip():
        return None
    try:
        arr = np.asarray(json.loads(raw), dtype=np.float32)
        if arr.shape != (4, 2):
            raise ValueError("custom_quad harus berupa 4 pasangan koordinat [x, y]")
        return arr
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Format custom_quad tidak valid: {exc}") from exc


@app.post("/api/analyze")
async def analyze(
    file: UploadFile | None = File(None),
    preset_id: str | None = Form(None),
    use_rectify: bool = Form(True),
    use_denoise: bool = Form(True),
    clahe_mode: Literal["auto", "on", "off"] = Form("auto"),
    conf_threshold: float = Form(DEFAULT_CONF),
    custom_quad: str | None = Form(None),
    return_preprocessed: bool = Form(True),
):
    quad_arr = _parse_custom_quad(custom_quad)
    conf_clamped = float(np.clip(conf_threshold, 0.10, 0.75))

    if preset_id:
        preset = next((p for p in STORE_PRESETS if p["id"] == preset_id), None)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset kamera tidak ditemukan")
        img_path = RAKTEST_DIR / preset["filename"]
        if not img_path.exists():
            raise HTTPException(status_code=404, detail="File citra preset tidak tersedia")
        bgr = decode_image_bgr(img_path.read_bytes())
    elif file is not None:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File harus berupa gambar (JPG, PNG, atau WEBP)")
        try:
            bgr = decode_image_bgr(await file.read())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    else:
        raise HTTPException(status_code=400, detail="Kirim file gambar atau pilih preset_id kamera")

    return await run_in_threadpool(
        process,
        bgr,
        use_rectify,
        use_denoise,
        clahe_mode,
        conf_clamped,
        quad_arr,
        return_preprocessed,
    )
