from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

from preprocess import decode_image_bgr, encode_jpeg_data_url, preprocess_image

MODEL_PATH = Path(__file__).resolve().parent / "best_sku110k_yolo11s_960.pt"
MODEL_LABEL = "YOLO11s-SKU110K@960"
IMGSZ = 960
CONF = 0.25
IOU = 0.5
MAX_DET = 1000
ROW_TOLERANCE = 0.65   # jarak vertikal (x tinggi median) untuk pisah baris
ROW_MERGE_TOL = 0.75   # gabung sub-baris yang pusat-y-nya berdekatan
MIN_ROW_PRODUCTS = 3   # filter klaster noise (<3 produk) jika ada baris valid
GAP_FACTOR = 1.0       # celah dihitung jika > 1x lebar median produk

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ganti dengan domain frontend saat produksi
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO(str(MODEL_PATH))


@app.get("/")
def read_root():
    return {"message": "ShelfAI API berjalan!", "model": MODEL_LABEL}


def group_rows(boxes: np.ndarray) -> list[np.ndarray]:
    """Klaster baris berdasarkan pusat-y, lalu gabung sub-baris yang terlalu berdekatan."""
    if len(boxes) == 0:
        return []

    cy = (boxes[:, 1] + boxes[:, 3]) / 2
    med_h = float(np.median(boxes[:, 3] - boxes[:, 1]))
    order = np.argsort(cy)

    groups, current = [], [order[0]]
    for i in order[1:]:
        if abs(cy[i] - np.mean(cy[current])) > ROW_TOLERANCE * med_h:
            groups.append(current)
            current = [i]
        else:
            current.append(i)
    groups.append(current)

    valid_rows = [boxes[g] for g in groups if len(g) >= MIN_ROW_PRODUCTS]
    if not valid_rows:
        valid_rows = [boxes[g] for g in groups]

    valid_rows.sort(key=lambda r: float(np.median((r[:, 1] + r[:, 3]) / 2)))
    if len(valid_rows) <= 1:
        return valid_rows

    merged_rows = [valid_rows[0]]
    for r in valid_rows[1:]:
        prev_y = float(np.mean((merged_rows[-1][:, 1] + merged_rows[-1][:, 3]) / 2))
        curr_y = float(np.mean((r[:, 1] + r[:, 3]) / 2))
        if abs(curr_y - prev_y) < ROW_MERGE_TOL * med_h:
            merged_rows[-1] = np.vstack([merged_rows[-1], r])
        else:
            merged_rows.append(r)
    return merged_rows


def analyze_shelf(boxes: np.ndarray):
    """boxes: array Nx4 [x1, y1, x2, y2]. Return (rows, gaps)."""
    if len(boxes) == 0:
        return [], []

    grouped_rows = group_rows(boxes)

    # Gunakan persentil 1%-99% agar box outlier di pinggir tidak merusak lebar rak
    if len(boxes) >= 10:
        shelf_x1 = float(np.percentile(boxes[:, 0], 1))
        shelf_x2 = float(np.percentile(boxes[:, 2], 99))
    else:
        shelf_x1, shelf_x2 = float(boxes[:, 0].min()), float(boxes[:, 2].max())

    rows, gaps = [], []
    for n, rb in enumerate(grouped_rows, start=1):
        rb = rb[np.argsort(rb[:, 0])]  # urut kiri ke kanan
        med_w = max(float(np.median(rb[:, 2] - rb[:, 0])), 1.0)
        y1, y2 = float(rb[:, 1].min()), float(rb[:, 3].max())

        # Gabungkan interval x yang overlap agar tidak muncul celah negatif/semu
        merged_x: list[list[float]] = []
        for x1, x2 in zip(rb[:, 0], rb[:, 2]):
            if merged_x and x1 <= merged_x[-1][1]:
                merged_x[-1][1] = max(merged_x[-1][1], float(x2))
            else:
                merged_x.append([float(x1), float(x2)])

        spans: list[tuple[float, float]] = []
        prev_end = shelf_x1
        for start_x, end_x in merged_x:
            if start_x > prev_end:
                spans.append((prev_end, start_x))
            prev_end = max(prev_end, end_x)
        if shelf_x2 > prev_end:
            spans.append((prev_end, shelf_x2))

        gap_slots = 0
        for a, b in spans:
            if (b - a) > GAP_FACTOR * med_w:
                gap_slots += max(1, int((b - a) // med_w))
                gaps.append({"row": n, "bbox": [round(a, 1), round(y1, 1), round(b, 1), round(y2, 1)]})

        products = len(rb)
        rows.append({
            "id": n,
            "products": products,
            "gap": gap_slots,
            "fill_percent": round(products / (products + gap_slots) * 100, 1),
            "bbox": [
                round(float(rb[:, 0].min()), 1),
                round(y1, 1),
                round(float(rb[:, 2].max()), 1),
                round(y2, 1),
            ],
        })
    return rows, gaps


def process(
    bgr: np.ndarray,
    use_denoise: bool = True,
    clahe_mode: Literal["auto", "on", "off"] = "auto",
    return_preprocessed: bool = False,
):
    orig_h, orig_w = bgr.shape[:2]
    proc_bgr, pre_meta = preprocess_image(
        bgr,
        use_denoise=use_denoise,
        clahe_mode=clahe_mode,
    )
    proc_h, proc_w = proc_bgr.shape[:2]

    result = model(proc_bgr, imgsz=IMGSZ, conf=CONF, iou=IOU, max_det=MAX_DET, verbose=False)[0]
    boxes = result.boxes.xyxy.cpu().numpy() if len(result.boxes) else np.empty((0, 4))

    # Kembalikan koordinat bounding box ke skala resolusi gambar asli agar pas dengan SVG frontend
    if len(boxes) and (proc_w != orig_w or proc_h != orig_h):
        boxes = boxes.copy()
        boxes[:, [0, 2]] *= orig_w / proc_w
        boxes[:, [1, 3]] *= orig_h / proc_h

    rows, gaps = analyze_shelf(boxes)
    total_products = sum(r["products"] for r in rows)
    total_gap = sum(r["gap"] for r in rows)
    total_fill = (
        round(total_products / (total_products + total_gap) * 100, 1)
        if total_products
        else 0
    )

    payload = {
        "model": MODEL_LABEL,
        "image_width": orig_w,
        "image_height": orig_h,
        "total_products": total_products,
        "total_fill": total_fill,
        "rows": rows,
        "boxes": [[round(float(v), 1) for v in b] for b in boxes],
        "gaps": gaps,
        "preprocessing": pre_meta,
    }
    if return_preprocessed:
        payload["preprocessed_image"] = encode_jpeg_data_url(proc_bgr)
    return payload


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    use_denoise: bool = Form(True),
    clahe_mode: Literal["auto", "on", "off"] = Form("auto"),
    return_preprocessed: bool = Form(False),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")
    try:
        bgr = decode_image_bgr(await file.read())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return await run_in_threadpool(process, bgr, use_denoise, clahe_mode, return_preprocessed)
