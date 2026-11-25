# Rakku

Sistem deteksi keterisian rak retail berbasis Computer Vision dan AI. Pengguna mengunggah foto rak, lalu sistem mendeteksi produk, mengelompokkannya per baris, mencari celah kosong, menghitung persentase keterisian, dan menandai baris yang perlu restock.

Proyek ini dibuat sebagai tugas akhir mata kuliah Visi Komputer.

## Fitur

- Deteksi produk pada foto rak dengan YOLO11 yang dilatih pada dataset SKU-110K
- Pengelompokan produk ke dalam baris rak
- Deteksi celah kosong dan estimasi jumlah slot kosong per baris
- Persentase keterisian per baris dan total rak
- Threshold restock yang bisa diatur lewat slider (hasil langsung berubah tanpa request ulang)
- Visualisasi overlay interaktif: box produk, celah kosong, dan garis baris

## Arsitektur

```
Rakku/
├── viskom-next/          # Frontend (Next.js, App Router)
│   └── app/components/   # Navbar, Hero, HowItWorks, DemoSection, AboutSection
└── viskom-backend/
    ├── preprocess.py     # Pipeline pemrosesan citra (EXIF, resize, Bilateral, Auto-CLAHE)
    ├── main.py           # Backend (FastAPI + Ultralytics YOLO11s)
    └── requirements.txt  # Dependensi Python backend
```

Backend mengirim **koordinat** (box produk, celah, baris) beserta metadata (dan opsional preview) hasil pemrosesan citra. Overlay digambar di frontend dengan SVG, sehingga toggle layer, toggle *Before/After* preprocessing, dan slider threshold tetap responsif. Flag restock dihitung di frontend dari `fill_percent < threshold`.

## Alur Pemrosesan

1. **Input citra**: unggah foto rak + koreksi orientasi EXIF otomatis (`ImageOps.exif_transpose`)
2. **Perbaikan citra (`preprocess.py`)**: resize aman `INTER_AREA` (`max_side=1280`) -> **Bilateral Filter** (`d=5, sigma=40`) -> **Auto-CLAHE** pada channel `L` ruang warna LAB (`clipLimit=1.5`, aktif otomatis saat `gray_mean < 65`)
3. **Deteksi produk**: inferensi `YOLO11s` @ `imgsz=960` (`conf=0.25`, `iou=0.5`, 1 kelas), lalu rescaling koordinat ke ukuran citra asli
4. **Klaster baris**: produk dikelompokkan berdasarkan posisi vertikal + penggabungan sub-baris berdekatan
5. **Hitung celah**: interval overlap digabung, jarak antar produk > `1x` lebar median produk dianggap celah
6. **Estimasi rasio**: `produk / (produk + slot kosong) x 100%` per baris
7. **Output**: overlay anotasi, preview before/after preprocessing, persentase keterisian, dan flag restock

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, Uvicorn, OpenCV (`opencv-python-headless`), Pillow, NumPy |
| Model | Ultralytics YOLO11s @ 960px (dilatih pada SKU-110K, `mAP@50 = 92.65%`) |

## Menjalankan Secara Lokal

### Prasyarat

- Node.js 20 atau lebih baru
- Python 3.10 atau lebih baru
- File bobot model `best_sku110k_yolo11s_960.pt`

### 1. Backend

```bash
cd viskom-backend

# (opsional tapi disarankan) virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

python -m pip install -r requirements.txt
```

Letakkan file `best_sku110k_yolo11s_960.pt` di folder `viskom-backend/` (sejajar dengan `main.py`), lalu jalankan:

```bash
python -m uvicorn main:app --reload
```

Backend berjalan di `http://127.0.0.1:8000`. Dokumentasi interaktif (Swagger) tersedia di `http://127.0.0.1:8000/docs`.

### 2. Frontend

Dari folder `viskom-next/`:

```bash
cd viskom-next
npm install
npm run dev
```

Buka `http://localhost:3000`, masuk ke bagian **Demo Interaktif**, unggah foto rak, atur opsi pemrosesan citra bila perlu, lalu klik **Jalankan Deteksi AI**.

Secara default frontend memanggil `http://localhost:8000`. Untuk mengubahnya, buat file `.env.local`:

```
NEXT_PUBLIC_API_URL=http://alamat-backend-anda
```

## API

### `GET /`

Pengecekan status server dan nama model aktif.

### `POST /api/analyze`

Menganalisis foto rak.

- **Body** (`multipart/form-data`):
  - `file` *(wajib)*: gambar JPG, PNG, atau WEBP
  - `use_denoise` *(opsional, default `true`)*: aktifkan Bilateral Filter
  - `clahe_mode` *(opsional, default `auto`)*: `"auto"` | `"on"` | `"off"`
  - `return_preprocessed` *(opsional, default `false`)*: sertakan gambar hasil preprocessing dalam base64 data URL
- **Respons** (JSON):

```json
{
  "model": "YOLO11s-SKU110K@960",
  "image_width": 2448,
  "image_height": 3264,
  "total_products": 140,
  "total_fill": 78.5,
  "rows": [
    {
      "id": 1,
      "products": 13,
      "gap": 2,
      "fill_percent": 86.7,
      "bbox": [x1, y1, x2, y2]
    }
  ],
  "boxes": [[x1, y1, x2, y2]],
  "gaps": [{ "row": 1, "bbox": [x1, y1, x2, y2] }],
  "preprocessing": {
    "orig_size": [2448, 3264],
    "proc_size": [960, 1280],
    "resized": true,
    "denoise_applied": true,
    "clahe_mode": "auto",
    "clahe_applied": false,
    "mean_before": 131.4,
    "mean_after": 131.2,
    "preprocess_ms": 42.5
  }
}
```

Semua koordinat dalam piksel pada gambar asli (sesudah koreksi EXIF). Kesalahan dikembalikan sebagai `400` (file bukan gambar atau tidak valid).

## Konfigurasi dan Penyetelan

Parameter ada di bagian atas `viskom-backend/main.py` dan `viskom-backend/preprocess.py`:

| Parameter | Fungsi |
|---|---|
| `IMGSZ` | Resolusi inferensi YOLO11s (`960`) |
| `CONF` | Ambang kepercayaan deteksi (`0.25`, bias paling seimbang) |
| `IOU` | Ambang NMS untuk membuang box yang tumpang tindih (`0.5`) |
| `MAX_DET` | Jumlah deteksi maksimum per gambar (`1000`) |
| `ROW_TOLERANCE` | Jarak vertikal (kali tinggi median produk) untuk memisahkan baris (`0.65`) |
| `ROW_MERGE_TOL` | Jarak vertikal untuk menggabungkan sub-baris berdekatan (`0.75`) |
| `GAP_FACTOR` | Celah dihitung jika lebih lebar dari faktor ini kali lebar median produk (`1.0`) |
| `DEFAULT_DARK_THRESHOLD` | Batas rata-rata intensitas grayscale (`65.0`) untuk mengaktifkan Auto-CLAHE |

## Batasan

- Pengelompokan baris paling akurat pada foto rak yang diambil lurus dari depan; koreksi perspektif (Homography 4 titik) dan SAHI belum diintegrasikan ke UI web.
- Model dilatih dengan 1 kelas, sehingga sistem tidak membedakan jenis produk.

## Lisensi dan Atribusi

- Dataset: [SKU-110K](https://github.com/eg4000/SKU110K_CVPR19)
- Model: [Ultralytics YOLO11](https://github.com/ultralytics/ultralytics)