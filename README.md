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
rakku/
├── app/                  # Frontend (Next.js, App Router)
│   └── components/       # Navbar, Hero, HowItWorks, DemoSection, AboutSection
└── viskom-backend/
    └── main.py           # Backend (FastAPI + Ultralytics YOLO)
```

Backend mengirim **koordinat** (box produk, celah, baris), bukan gambar beranotasi. Overlay digambar di frontend dengan SVG, sehingga toggle layer dan slider threshold responsif. Flag restock dihitung di frontend dari `fill_percent < threshold`.

## Alur Pemrosesan

1. Input citra: unggah foto rak
2. Deteksi produk: inferensi YOLO11 (1 kelas)
3. Klaster baris: produk dikelompokkan berdasarkan posisi vertikal
4. Hitung celah: jarak antar produk yang lebih besar dari 1x lebar median produk dianggap celah
5. Estimasi rasio: `produk / (produk + slot kosong) x 100%` per baris
6. Output: overlay anotasi, persentase keterisian, dan flag restock

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, Uvicorn, Pillow, NumPy |
| Model | Ultralytics YOLO11 (dilatih pada SKU-110K) |

## Menjalankan Secara Lokal

### Prasyarat

- Node.js 20 atau lebih baru
- Python 3.10 atau lebih baru
- File bobot model `best_sku110k_yolo11n2.pt`

### 1. Backend

```bash
cd viskom-backend

# (opsional tapi disarankan) virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

python -m pip install fastapi "uvicorn[standard]" python-multipart pillow numpy ultralytics
```

Letakkan file `best_sku110k_yolo11n2.pt` di folder `viskom-backend/` (sejajar dengan `main.py`), lalu jalankan:

```bash
python -m uvicorn main:app --reload
```

Backend berjalan di `http://127.0.0.1:8000`. Dokumentasi interaktif (Swagger) tersedia di `http://127.0.0.1:8000/docs`.

### 2. Frontend

Dari root repo:

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`, masuk ke bagian **Demo Interaktif**, unggah foto rak, lalu klik **Jalankan Deteksi AI**.

Secara default frontend memanggil `http://localhost:8000`. Untuk mengubahnya, buat file `.env.local`:

```
NEXT_PUBLIC_API_URL=http://alamat-backend-anda
```

## API

### `GET /`

Pengecekan status server.

### `POST /api/analyze`

Menganalisis foto rak.

- **Body**: `multipart/form-data` dengan field `file` (gambar JPG, PNG, atau WEBP)
- **Respons** (JSON):

```json
{
  "image_width": 960,
  "image_height": 736,
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
  "gaps": [{ "row": 1, "bbox": [x1, y1, x2, y2] }]
}
```

Semua koordinat dalam piksel pada gambar asli. Kesalahan dikembalikan sebagai `400` (file bukan gambar atau tidak valid).

## Konfigurasi dan Penyetelan

Parameter ada di bagian atas `viskom-backend/main.py`:

| Parameter | Fungsi |
|---|---|
| `CONF` | Ambang kepercayaan deteksi. Lebih rendah menangkap lebih banyak produk, tapi lebih banyak duplikat |
| `IOU` | Ambang NMS untuk membuang box yang tumpang tindih |
| `MAX_DET` | Jumlah deteksi maksimum per gambar |
| `ROW_TOLERANCE` | Jarak vertikal (kali tinggi median produk) untuk memisahkan baris |
| `GAP_FACTOR` | Celah dihitung jika lebih lebar dari faktor ini kali lebar median produk |

## Batasan

- Pengelompokan baris paling akurat pada foto rak yang diambil lurus dari depan; foto dengan perspektif kuat bisa membuat baris tidak terpisah dengan benar.
- Tahap perbaikan citra (resize, CLAHE, bilateral denoise) dan SAHI belum diimplementasikan di backend.
- Model dilatih dengan 1 kelas, sehingga sistem tidak membedakan jenis produk.

## Lisensi dan Atribusi

- Dataset: [SKU-110K](https://github.com/eg4000/SKU110K_CVPR19)
- Model: [Ultralytics YOLO11](https://github.com/ultralytics/ultralytics)