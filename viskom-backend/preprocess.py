import base64
import io
import time
from typing import Literal

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

ClaheMode = Literal["auto", "on", "off"]

DEFAULT_MAX_SIDE = 1280
DEFAULT_DARK_THRESHOLD = 65.0
DEFAULT_CLAHE_CLIP = 1.5
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


def apply_clahe_bgr(
    bgr: np.ndarray,
    clip_limit: float = DEFAULT_CLAHE_CLIP,
    tile_grid_size: tuple[int, int] = DEFAULT_CLAHE_TILE,
) -> np.ndarray:
    """Apply CLAHE only on the L channel in LAB color space to prevent color shift."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    l_eq = clahe.apply(l_ch)
    return cv2.cvtColor(cv2.merge([l_eq, a_ch, b_ch]), cv2.COLOR_LAB2BGR)


def preprocess_image(
    bgr: np.ndarray,
    max_side: int = DEFAULT_MAX_SIDE,
    use_denoise: bool = True,
    clahe_mode: ClaheMode = "auto",
    dark_threshold: float = DEFAULT_DARK_THRESHOLD,
    clahe_clip: float = DEFAULT_CLAHE_CLIP,
) -> tuple[np.ndarray, dict]:
    """Run image processing pipeline: INTER_AREA resize -> Bilateral denoise -> Conditional LAB-CLAHE."""
    t0 = time.perf_counter()
    orig_h, orig_w = bgr.shape[:2]
    mean_before = float(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).mean())

    out = bgr
    scale = min(1.0, max_side / max(orig_h, orig_w))
    if scale < 1.0:
        new_w = max(1, int(round(orig_w * scale)))
        new_h = max(1, int(round(orig_h * scale)))
        out = cv2.resize(out, (new_w, new_h), interpolation=cv2.INTER_AREA)

    proc_h, proc_w = out.shape[:2]

    if use_denoise:
        out = cv2.bilateralFilter(out, d=5, sigmaColor=40, sigmaSpace=40)

    gray_after_denoise = float(cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).mean())
    if clahe_mode == "on":
        should_clahe = True
    elif clahe_mode == "off":
        should_clahe = False
    else:
        should_clahe = gray_after_denoise < dark_threshold

    if should_clahe:
        out = apply_clahe_bgr(out, clip_limit=clahe_clip, tile_grid_size=DEFAULT_CLAHE_TILE)

    mean_after = float(cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).mean())
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    meta = {
        "orig_size": [orig_w, orig_h],
        "proc_size": [proc_w, proc_h],
        "resized": bool(proc_w != orig_w or proc_h != orig_h),
        "denoise_applied": bool(use_denoise),
        "clahe_mode": clahe_mode,
        "clahe_applied": bool(should_clahe),
        "mean_before": round(mean_before, 1),
        "mean_after": round(mean_after, 1),
        "preprocess_ms": round(elapsed_ms, 1),
    }
    return out, meta


def encode_jpeg_data_url(bgr: np.ndarray, quality: int = 85) -> str:
    """Encode BGR image as a base64 JPEG data URL for frontend preview."""
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("Gagal mengenkode gambar hasil preprocessing")
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
