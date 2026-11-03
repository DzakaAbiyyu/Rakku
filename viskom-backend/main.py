import io

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO

CONF = 0.35
IOU = 0.5
MAX_DET = 1000
ROW_TOLERANCE = 0.6   # jarak vertikal (x tinggi median) untuk pisah baris
GAP_FACTOR = 1.0      # celah dihitung jika > 1x lebar median produk

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ganti dengan domain frontend saat produksi
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("best_sku110k_yolo11n2.pt")


@app.get("/")
def read_root():
    return {"message": "ShelfAI API berjalan!"}


def load_image(content: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(content)).convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="File gambar tidak valid")


def analyze_shelf(boxes: np.ndarray):
    """boxes: array Nx4 [x1, y1, x2, y2]. Return (rows, gaps)."""
    if len(boxes) == 0:
        return [], []

    # --- Klaster baris: urutkan by pusat-y, pisah jika loncat jauh ---
    cy = (boxes[:, 1] + boxes[:, 3]) / 2
    med_h = float(np.median(boxes[:, 3] - boxes[:, 1]))
    order = np.argsort(cy)

    groups, current = [], [order[0]]
    for i in order[1:]:
        if cy[i] - np.mean(cy[current]) > ROW_TOLERANCE * med_h:
            groups.append(current)
            current = [i]
        else:
            current.append(i)
    groups.append(current)

    # Lebar rak = rentang x seluruh produk
    shelf_x1, shelf_x2 = float(boxes[:, 0].min()), float(boxes[:, 2].max())

    rows, gaps = [], []
    for n, idx in enumerate(groups, start=1):
        rb = boxes[idx]
        rb = rb[np.argsort(rb[:, 0])]  # urut kiri ke kanan
        med_w = float(np.median(rb[:, 2] - rb[:, 0]))
        y1, y2 = float(rb[:, 1].min()), float(rb[:, 3].max())

        # Ruang antar produk, termasuk tepi kiri dan kanan rak
        spans = [(shelf_x1, float(rb[0, 0]))]
        spans += [(float(rb[i, 2]), float(rb[i + 1, 0])) for i in range(len(rb) - 1)]
        spans.append((float(rb[-1, 2]), shelf_x2))

        gap_slots = 0
        for a, b in spans:
            if (b - a) > GAP_FACTOR * med_w:
                gap_slots += int((b - a) // med_w)
                gaps.append({"row": n, "bbox": [a, y1, b, y2]})

        products = len(rb)
        rows.append({
            "id": n,
            "products": products,
            "gap": gap_slots,
            "fill_percent": round(products / (products + gap_slots) * 100, 1),
            "bbox": [float(rb[:, 0].min()), y1, float(rb[:, 2].max()), y2],
        })
    return rows, gaps


def process(image: Image.Image):
    result = model(image, conf=CONF, iou=IOU, max_det=MAX_DET)[0]
    boxes = result.boxes.xyxy.cpu().numpy() if len(result.boxes) else np.empty((0, 4))

    rows, gaps = analyze_shelf(boxes)
    total_products = sum(r["products"] for r in rows)
    total_gap = sum(r["gap"] for r in rows)
    total_fill = (
        round(total_products / (total_products + total_gap) * 100, 1)
        if total_products else 0
    )

    return {
        "image_width": image.width,
        "image_height": image.height,
        "total_products": total_products,
        "total_fill": total_fill,
        "rows": rows,
        "boxes": [[round(float(v), 1) for v in b] for b in boxes],
        "gaps": gaps,
    }


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")
    image = load_image(await file.read())
    return await run_in_threadpool(process, image)