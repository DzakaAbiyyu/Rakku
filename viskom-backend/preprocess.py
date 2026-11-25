import base64
import io
from typing import Literal

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

ClaheMode = Literal["auto", "on", "off"]

DEFAULT_MAX_SIDE = 1280
DEFAULT_ROI_MEAN_DARK = 95.0
DEFAULT_ROI_P25_DARK = 58.0
DEFAULT_CLAHE_CLIP = 1.8
DEFAULT_CLAHE_TILE = (8, 8)


def decode_image_bgr(content: bytes) -> np.ndarray:
    """Decode raw image bytes, apply EXIF orientation, and return a BGR ndarray."""
    try:
        with Image.open(io.BytesIO(content)) as pil_img:
            pil_img = ImageOps.exif_transpose(pil_img).convert("RGB")
            rgb = np.asarray(pil_img)
    except UnidentifiedImageError as exc:
        raise ValueError("File gambar tidak valid") from exc
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def resize_max_side(bgr: np.ndarray, max_side: int = DEFAULT_MAX_SIDE) -> tuple[np.ndarray, float]:
    h, w = bgr.shape[:2]
    scale = min(1.0, max_side / max(h, w))
    if scale < 1.0:
        nw = max(1, int(round(w * scale)))
        nh = max(1, int(round(h * scale)))
        return cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_AREA), scale
    return bgr.copy(), 1.0


def order_quad_points(pts: np.ndarray) -> np.ndarray:
    """Order 4 points clockwise as [TL, TR, BR, BL]."""
    arr = np.asarray(pts, dtype=np.float32).reshape(4, 2)
    y_order = arr[np.argsort(arr[:, 1])]
    top2 = y_order[:2][np.argsort(y_order[:2, 0])]
    bot2 = y_order[2:][np.argsort(y_order[2:, 0])]
    return np.array([top2[0], top2[1], bot2[1], bot2[0]], dtype=np.float32)


def apply_clahe_bgr(
    bgr: np.ndarray,
    clip_limit: float = DEFAULT_CLAHE_CLIP,
    tile_grid_size: tuple[int, int] = DEFAULT_CLAHE_TILE,
) -> np.ndarray:
    """Apply CLAHE on LAB L-channel so local shadows lift without shifting package hues."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    l_eq = clahe.apply(l_ch)
    return cv2.cvtColor(cv2.merge([l_eq, a_ch, b_ch]), cv2.COLOR_LAB2BGR)


def compute_roi_histogram(gray: np.ndarray, mask: np.ndarray | None = None, bins: int = 32) -> list[int]:
    pixels = gray[mask > 0] if mask is not None and np.any(mask > 0) else gray.ravel()
    if pixels.size == 0:
        return [0] * bins
    hist, _ = np.histogram(pixels, bins=bins, range=(0, 256))
    peak = int(hist.max())
    if peak == 0:
        return [0] * bins
    return [int(round(float(v) / peak * 100)) for v in hist]


def enhance_with_roi_stats(
    bgr: np.ndarray,
    quad: np.ndarray | None,
    use_denoise: bool = True,
    clahe_mode: ClaheMode = "auto",
) -> tuple[np.ndarray, dict]:
    """Run bilateral denoise and ROI shadow-aware LAB-CLAHE unaffected by bright ceiling/floor."""
    h, w = bgr.shape[:2]
    mask = None
    if quad is not None:
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillConvexPoly(mask, np.round(quad).astype(np.int32), 255)

    gray_before = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    roi_vals = gray_before[mask > 0] if mask is not None and np.any(mask > 0) else gray_before.ravel()
    mean_before = float(np.mean(roi_vals))
    p25_before = float(np.percentile(roi_vals, 25))
    hist_before = compute_roi_histogram(gray_before, mask)

    out = bgr.copy()
    if use_denoise:
        out = cv2.bilateralFilter(out, d=5, sigmaColor=35, sigmaSpace=35)

    if clahe_mode == "on":
        should_clahe = True
    elif clahe_mode == "off":
        should_clahe = False
    else:
        should_clahe = mean_before < DEFAULT_ROI_MEAN_DARK or p25_before < DEFAULT_ROI_P25_DARK

    if should_clahe:
        out = apply_clahe_bgr(out)

    gray_after = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
    roi_after = gray_after[mask > 0] if mask is not None and np.any(mask > 0) else gray_after.ravel()
    mean_after = float(np.mean(roi_after))
    hist_after = compute_roi_histogram(gray_after, mask)

    return out, {
        "denoise_applied": bool(use_denoise),
        "clahe_mode": clahe_mode,
        "clahe_applied": bool(should_clahe),
        "mean_before": round(mean_before, 1),
        "p25_before": round(p25_before, 1),
        "mean_after": round(mean_after, 1),
        "hist_before": hist_before,
        "hist_after": hist_after,
    }


def _weighted_ransac_line(
    x: np.ndarray,
    y: np.ndarray,
    w: np.ndarray,
    thresh: float = 0.055,
    n_iter: int = 350,
    seed: int = 42,
) -> tuple[float, float, np.ndarray]:
    n = len(x)
    if n < 2:
        b0 = float(np.average(y, weights=w)) if n == 1 else 0.0
        return 0.0, b0, np.ones(n, dtype=bool)

    rng = np.random.default_rng(seed)
    w_safe = np.maximum(w, 1e-6)
    probs = w_safe / w_safe.sum()

    order = np.argsort(y)
    cum = np.cumsum(w_safe[order])
    wmed = float(y[order[min(len(order) - 1, int(np.searchsorted(cum, 0.5 * cum[-1])))]])
    best_mask = np.abs(y - wmed) < thresh
    best_score = float(w_safe[best_mask].sum())

    for _ in range(n_iter):
        i, j = rng.choice(n, size=2, replace=False, p=probs)
        dx = x[j] - x[i]
        if abs(dx) < 0.05:
            continue
        a = (y[j] - y[i]) / dx
        if abs(a) > 0.85:
            continue
        b = y[i] - a * x[i]
        mask = np.abs(y - (a * x + b)) < thresh
        score = float(w_safe[mask].sum())
        if score > best_score:
            best_score = score
            best_mask = mask

    if best_mask.sum() >= 2:
        xi, yi, wi = x[best_mask], y[best_mask], w_safe[best_mask]
        if float(np.ptp(xi)) > 0.14:
            sx = float(np.sum(wi * xi))
            sy = float(np.sum(wi * yi))
            sxx = float(np.sum(wi * xi * xi))
            sxy = float(np.sum(wi * xi * yi))
            sw = float(np.sum(wi))
            denom = sw * sxx - sx * sx
            if abs(denom) > 1e-9:
                a = float(np.clip((sw * sxy - sx * sy) / denom, -0.65, 0.65))
                b = (sy - a * sx) / sw
                return a, float(b), best_mask

    b = float(np.average(y[best_mask], weights=w_safe[best_mask])) if best_mask.any() else 0.0
    return 0.0, b, best_mask


def _intersect_hv(
    y0: float, m: float, x0: float, k: float, xc: float, yc: float
) -> tuple[float, float] | None:
    denom = 1.0 - k * m
    if abs(denom) < 1e-5:
        return None
    x = (k * (y0 - m * xc - yc) + x0) / denom
    y = m * (x - xc) + y0
    return float(x), float(y)


def extract_line_segments(bgr: np.ndarray, det_max_side: int = 720) -> np.ndarray:
    h, w = bgr.shape[:2]
    scale = min(1.0, det_max_side / max(h, w))
    small = (
        cv2.resize(bgr, (max(1, int(round(w * scale))), max(1, int(round(h * scale)))), interpolation=cv2.INTER_AREA)
        if scale < 1.0
        else bgr
    )
    sh, sw = small.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (3, 3), 0)

    segs = None
    if hasattr(cv2, "createLineSegmentDetector"):
        lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
        lines = lsd.detect(gray)[0]
        if lines is not None:
            segs = lines.reshape(-1, 4).astype(np.float32)
    if segs is None:
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=55, minLineLength=int(min(sh, sw) * 0.06), maxLineGap=15
        )
        segs = lines.reshape(-1, 4).astype(np.float32) if lines is not None else np.empty((0, 4), dtype=np.float32)

    if len(segs):
        segs = segs.copy()
        segs[:, [0, 2]] *= w / sw
        segs[:, [1, 3]] *= h / sh
    return segs


def _fit_quad_inside_roi(
    segs: np.ndarray,
    roi_box: tuple[float, float, float, float],
    img_w: int,
    img_h: int,
) -> tuple[np.ndarray, float, str]:
    rx1, ry1, rx2, ry2 = roi_box
    rw = max(rx2 - rx1, 64.0)
    rh = max(ry2 - ry1, 64.0)
    xc, yc = 0.5 * (rx1 + rx2), 0.5 * (ry1 + ry2)

    pad_x, pad_y = 0.06 * rw, 0.06 * rh
    min_len_h = 0.045 * max(rw, rh)
    min_len_v = 0.055 * max(rw, rh)

    h_segs, v_segs = [], []
    for x1, y1, x2, y2 in segs:
        xm, ym = 0.5 * (x1 + x2), 0.5 * (y1 + y2)
        if not (rx1 - pad_x <= xm <= rx2 + pad_x and ry1 - pad_y <= ym <= ry2 + pad_y):
            continue
        dx, dy = float(x2 - x1), float(y2 - y1)
        length = float(np.hypot(dx, dy))
        if length < min(min_len_h, min_len_v):
            continue
        ang = abs(np.degrees(np.arctan2(dy, dx)))
        if ang > 90.0:
            ang = 180.0 - ang
        if ang <= 36.0 and length >= min_len_h and abs(dx) > 1e-3:
            h_segs.append((xm, ym, dy / dx, length))
        elif ang >= 68.0 and length >= min_len_v and abs(dy) > 1e-3:
            v_segs.append((xm, ym, dx / dy, length))

    default_quad = np.array([[rx1, ry1], [rx2, ry1], [rx2, ry2], [rx1, ry2]], dtype=np.float32)
    if len(h_segs) < 3:
        return default_quad, 0.0, "roi_axis_box"

    hy = np.array([(s[1] - yc) / rh for s in h_segs])
    hm = np.array([s[2] for s in h_segs])
    hw = np.array([s[3] ** 1.35 for s in h_segs])
    a_h, b_h, h_mask = _weighted_ransac_line(hy, hm, hw)
    h_ratio = float(hw[h_mask].sum() / hw.sum()) if hw.sum() > 0 else 0.0
    if h_mask.sum() < 3 or h_ratio < 0.30:
        return default_quad, 0.0, "roi_axis_box"

    a_v, b_v = 0.0, 0.0
    if len(v_segs) >= 3:
        vx = np.array([(s[0] - xc) / rw for s in v_segs])
        vk = np.array([s[2] for s in v_segs])
        vw = np.array([s[3] ** 1.35 for s in v_segs])
        av_cand, bv_cand, v_mask = _weighted_ransac_line(vx, vk, vw)
        v_ratio = float(vw[v_mask].sum() / vw.sum()) if vw.sum() > 0 else 0.0
        if v_mask.sum() >= 3 and v_ratio >= 0.32:
            a_v, b_v = av_cand, bv_cand

    m_t = a_h * ((ry1 - yc) / rh) + b_h
    m_b = a_h * ((ry2 - yc) / rh) + b_h
    k_l = a_v * ((rx1 - xc) / rw) + b_v
    k_r = a_v * ((rx2 - xc) / rw) + b_v

    max_deg = float(
        max(
            abs(np.degrees(np.arctan(m_t))),
            abs(np.degrees(np.arctan(m_b))),
            abs(np.degrees(np.arctan(k_l))),
            abs(np.degrees(np.arctan(k_r))),
        )
    )

    tl = _intersect_hv(ry1, m_t, rx1, k_l, xc, yc)
    tr = _intersect_hv(ry1, m_t, rx2, k_r, xc, yc)
    br = _intersect_hv(ry2, m_b, rx2, k_r, xc, yc)
    bl = _intersect_hv(ry2, m_b, rx1, k_l, xc, yc)
    if any(p is None for p in (tl, tr, br, bl)):
        return default_quad, 0.0, "roi_axis_box"

    quad = order_quad_points(np.array([tl, tr, br, bl], dtype=np.float32))
    quad[:, 0] = np.clip(quad[:, 0], 0.0, float(img_w))
    quad[:, 1] = np.clip(quad[:, 1], 0.0, float(img_h))

    area = float(cv2.contourArea(quad))
    if area < 0.12 * rw * rh:
        return default_quad, 0.0, "roi_axis_box"

    return quad, round(max_deg, 1), "hybrid_lsd_ransac"


def _split_bays_by_vertical_posts(
    fg_boxes: np.ndarray, segs: np.ndarray, img_w: int, img_h: int
) -> list[tuple[str, np.ndarray]]:
    """Detect whether foreground products belong to multiple side-by-side gondola bays."""
    x_min, x_max = float(fg_boxes[:, 0].min()), float(fg_boxes[:, 2].max())
    span_w = x_max - x_min
    if span_w < 0.72 * img_w or len(fg_boxes) < 16:
        return [("Zona Rak Utama", fg_boxes)]

    # Scan candidate vertical seams in [24%..74%] where minimal boxes are crossed
    best_post_x = None
    best_post_score = -1.0
    xs = np.linspace(x_min + 0.24 * span_w, x_max - 0.24 * span_w, 45)
    for xm in xs:
        crossed = int(np.sum((fg_boxes[:, 0] + 10.0 < xm) & (fg_boxes[:, 2] - 10.0 > xm)))
        if crossed > 1:
            continue
        # Accumulate vertical post segments near xm
        v_support = 0.0
        for x1, y1, x2, y2 in segs:
            if abs(0.5 * (x1 + x2) - xm) <= 0.03 * img_w:
                dx, dy = float(x2 - x1), float(y2 - y1)
                ang = abs(np.degrees(np.arctan2(dy, dx)))
                if ang > 90.0:
                    ang = 180.0 - ang
                if ang >= 75.0:
                    v_support += float(np.hypot(dx, dy))
        score = (v_support + 0.15 * img_h) / (1.0 + 2.0 * crossed)
        if score > best_post_score:
            best_post_score = score
            best_post_x = float(xm)

    if best_post_x is None:
        return [("Zona Rak Utama", fg_boxes)]

    cx = 0.5 * (fg_boxes[:, 0] + fg_boxes[:, 2])
    left_b = fg_boxes[cx < best_post_x]
    right_b = fg_boxes[cx >= best_post_x]
    if len(left_b) < 6 or len(right_b) < 6:
        return [("Zona Rak Utama", fg_boxes)]

    med_w_l = float(np.median(left_b[:, 2] - left_b[:, 0]))
    med_w_r = float(np.median(right_b[:, 2] - right_b[:, 0]))
    if max(med_w_l, med_w_r) / max(min(med_w_l, med_w_r), 1.0) < 1.25:
        return [("Zona Rak Utama", fg_boxes)]

    bays = [("Gondola Kiri", left_b), ("Gondola Kanan", right_b)]
    bays.sort(
        key=lambda item: float(np.sum((item[1][:, 2] - item[1][:, 0]) * (item[1][:, 3] - item[1][:, 1]))),
        reverse=True,
    )
    return bays


def detect_shelf_bays_classical(
    bgr: np.ndarray,
    coarse_boxes: np.ndarray,
) -> tuple[np.ndarray, float, str, list[dict]]:
    """
    Estimate 4-corner shelf polygon(s) by isolating foreground shelf clusters
    (rejecting distant aisles & side wire baskets) and fitting projective LSD+RANSAC rails.
    """
    h, w = bgr.shape[:2]
    segs = extract_line_segments(bgr)

    if len(coarse_boxes) < 3:
        roi = (0.04 * w, 0.04 * h, 0.96 * w, 0.96 * h)
        quad, deg, src = _fit_quad_inside_roi(segs, roi, w, h)
        return quad, deg, src, [{"id": 1, "label": "Zona Rak 1", "quad": quad.tolist()}]

    bw = coarse_boxes[:, 2] - coarse_boxes[:, 0]
    bh = coarse_boxes[:, 3] - coarse_boxes[:, 1]
    p75_h = float(np.percentile(bh, 75))
    # Reject tiny far-background aisle detections in oblique CCTV views
    fg_mask = (bh >= 0.36 * p75_h) & (bw >= 14.0)
    fg = coarse_boxes[fg_mask] if int(fg_mask.sum()) >= 4 else coarse_boxes

    # 1D horizontal gap clustering to separate main foreground rack from distant side aisles
    med_w = float(np.median(fg[:, 2] - fg[:, 0]))
    med_h = float(np.median(fg[:, 3] - fg[:, 1]))
    x_order = np.argsort(0.5 * (fg[:, 0] + fg[:, 2]))
    clusters: list[list[int]] = [[int(x_order[0])]]
    cluster_max_x = float(fg[x_order[0], 2])

    for idx in x_order[1:]:
        idx_i = int(idx)
        # Separate if empty horizontal gap between clusters exceeds 1.85x median product width
        if float(fg[idx_i, 0]) - cluster_max_x > max(1.85 * med_w, 0.14 * w):
            clusters.append([idx_i])
            cluster_max_x = float(fg[idx_i, 2])
        else:
            clusters[-1].append(idx_i)
            cluster_max_x = max(cluster_max_x, float(fg[idx_i, 2]))

    # Score clusters by total foreground box area (main shelf dominates side wire baskets / far racks)
    clusters.sort(
        key=lambda idxs: float(
            np.sum((fg[idxs, 2] - fg[idxs, 0]) * (fg[idxs, 3] - fg[idxs, 1]))
        ),
        reverse=True,
    )
    main_fg = fg[clusters[0]]

    # Trim isolated side-basket outliers (e.g., narrow wire rack hanging off the left/right steel post)
    if len(main_fg) >= 10:
        cx = 0.5 * (main_fg[:, 0] + main_fg[:, 2])
        x_lo, x_hi = float(np.percentile(cx, 8)), float(np.percentile(cx, 92))
        core_mask = (main_fg[:, 2] >= x_lo - 1.2 * med_w) & (main_fg[:, 0] <= x_hi + 1.2 * med_w)
        if int(core_mask.sum()) >= int(0.82 * len(main_fg)):
            main_fg = main_fg[core_mask]

    bay_groups = _split_bays_by_vertical_posts(main_fg, segs, w, h)
    candidate_bays: list[dict] = []
    primary_quad = None
    primary_deg = 0.0
    primary_src = "hybrid_lsd_ransac"

    for idx, (label, b_boxes) in enumerate(bay_groups, start=1):
        pad_x = min(0.35 * med_w, 0.03 * w)
        pad_y = min(0.22 * med_h, 0.03 * h)
        roi = (
            max(0.0, float(b_boxes[:, 0].min()) - pad_x),
            max(0.0, float(b_boxes[:, 1].min()) - pad_y),
            min(float(w), float(b_boxes[:, 2].max()) + pad_x),
            min(float(h), float(b_boxes[:, 3].max()) + pad_y),
        )
        q, deg, src = _fit_quad_inside_roi(segs, roi, w, h)
        candidate_bays.append({"id": idx, "label": f"Rak {idx}: {label}", "quad": q.tolist()})
        if primary_quad is None:
            primary_quad, primary_deg, primary_src = q, deg, src

    assert primary_quad is not None
    return primary_quad, primary_deg, primary_src, candidate_bays


def compute_homography_matrices(quad: np.ndarray) -> tuple[np.ndarray, np.ndarray, int, int, float]:
    """Build H (camera -> metric 2D shelf plane) and H_inv (metric 2D -> camera) without image blur."""
    q = order_quad_points(quad)
    top_w = float(np.hypot(q[1, 0] - q[0, 0], q[1, 1] - q[0, 1]))
    bot_w = float(np.hypot(q[2, 0] - q[3, 0], q[2, 1] - q[3, 1]))
    left_h = float(np.hypot(q[3, 0] - q[0, 0], q[3, 1] - q[0, 1]))
    right_h = float(np.hypot(q[2, 0] - q[1, 0], q[2, 1] - q[1, 1]))

    rect_w = int(np.clip(round(max(top_w, bot_w)), 240, 1400))
    rect_h = int(np.clip(round(max(left_h, right_h)), 240, 1400))

    dst = np.array([[0, 0], [rect_w, 0], [rect_w, rect_h], [0, rect_h]], dtype=np.float32)
    h_mat = cv2.getPerspectiveTransform(q, dst)
    h_inv = cv2.getPerspectiveTransform(dst, q)

    ang_top = abs(np.degrees(np.arctan2(q[1, 1] - q[0, 1], max(1e-3, q[1, 0] - q[0, 0]))))
    ang_bot = abs(np.degrees(np.arctan2(q[2, 1] - q[3, 1], max(1e-3, q[2, 0] - q[3, 0]))))
    ang_l = abs(np.degrees(np.arctan2(q[3, 0] - q[0, 0], max(1e-3, q[3, 1] - q[0, 1]))))
    ang_r = abs(np.degrees(np.arctan2(q[2, 0] - q[1, 0], max(1e-3, q[2, 1] - q[1, 1]))))
    tilt_deg = round(float(max(ang_top, ang_bot, ang_l, ang_r)), 1)
    return h_mat, h_inv, rect_w, rect_h, tilt_deg


def project_points(pts: np.ndarray, h_mat: np.ndarray) -> np.ndarray:
    arr = np.asarray(pts, dtype=np.float32).reshape(-1, 1, 2)
    if len(arr) == 0:
        return np.empty((0, 2), dtype=np.float32)
    return cv2.perspectiveTransform(arr, h_mat).reshape(-1, 2)


def rect_box_to_camera_poly(
    rect_bbox: list[float] | tuple[float, float, float, float],
    h_inv: np.ndarray,
    sx: float = 1.0,
    sy: float = 1.0,
) -> list[list[float]]:
    x1, y1, x2, y2 = rect_bbox
    corners = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
    cam_pts = project_points(corners, h_inv)
    cam_pts[:, 0] *= sx
    cam_pts[:, 1] *= sy
    return [[round(float(px), 1), round(float(py), 1)] for px, py in cam_pts]


def detect_rectified_rail_peaks(planogram_bgr: np.ndarray) -> list[float]:
    """Detect physical horizontal shelf-rail Y positions (normalized 0..1) via Sobel-Y projection."""
    rh, _ = planogram_bgr.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(planogram_bgr, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    sobel_y = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))
    profile = sobel_y.mean(axis=1)

    k = max(5, int(round(rh * 0.02)) | 1)
    smooth = np.convolve(profile, np.ones(k, dtype=np.float32) / k, mode="same")
    thresh = float(smooth.mean() + 0.55 * smooth.std())
    min_dist = max(24, int(rh * 0.11))

    peaks: list[int] = []
    for y in range(6, rh - 6):
        if smooth[y] >= thresh and smooth[y] == np.max(smooth[max(0, y - 5) : min(rh, y + 6)]):
            if not peaks or (y - peaks[-1]) >= min_dist:
                peaks.append(y)
            elif smooth[y] > smooth[peaks[-1]]:
                peaks[-1] = y

    return [round(float(p) / max(rh, 1), 3) for p in peaks]


def encode_jpeg_data_url(bgr: np.ndarray, quality: int = 84) -> str:
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("Gagal mengenkode gambar hasil pemrosesan")
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
