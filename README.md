# Rakku

Sistem pemantauan keterisian rak retail berbasis Visi Komputer dan Geometri Perspektif Kamera Toko/CCTV. Aplikasi ini mengisolasi bidang 4 sudut rak, mendeteksi produk pada potongan ROI piksel tajam dengan YOLO11s, lalu memetakan koordinat produk dan celah kosong menggunakan **Coordinate-Space Homography** agar bebas dari distorsi 3D kemasan maupun bias perspektif dekat-jauh.

Proyek ini dikembangkan untuk mata kuliah Visi Komputer dan Pemrosesan Citra.

## Fitur Utama

- **Isolasi Poligon 4 Sudut Rak**: Mendukung model keypoint `YOLO11n-pose` (`best_shelf_quad_yolo11n.pt`), *fallback* otomatis berbasis klaster produk + *LSD-RANSAC*, pemisahan multi-gondola berdampingan, serta kalibrasi 4 sudut interaktif (sentuh, mouse, dan keyboard).
- **Coordinate-Space Homography (`H` & `H⁻¹`)**: Inferensi `YOLO11s@960` tetap berjalan pada piksel asli yang tajam tanpa *warp blur*, sementara pengelompokan baris dan perhitungan lebar celah dinormalisasi di bidang metrik 2D rak lalu diproyeksikan balik ke perspektif kamera.
- **Shadow-Aware ROI LAB-CLAHE & Bilateral Filter**: Mengukur kecerahan khusus di dalam poligon rak (`mean < 95` atau `P25 < 58`) sehingga bayangan gelap di rak bawah tetap terangkat tanpa tertipu lampu plafon toko.
- **Halaman Terpisah `/` dan `/dashboard`**: Halaman utama menjelaskan arsitektur sistem, sedangkan `/dashboard` menyediakan ruang kerja responsif (Mobile, Tablet, Desktop) dengan 5 preset kamera minimarket nyata, unggah file, input kamera ponsel/tablet, tampilan Planogram 2D, histogram intensitas ROI, dan mode Terang/Gelap.

## Struktur Proyek

```
project/
├── shelfProject-yolo11splus.ipynb      # Notebook eksperimen detektor produk SKU-110K (YOLO11s@960)
├── shelfProject-shelf-quad-pose.ipynb  # Notebook training detektor 4 sudut rak (YOLO11n-pose) & fine-tuning lokal
├── raktest/                            # 5 foto uji minimarket nyata (preset CAM-01 s.d. CAM-05)
└── Rakku/
    ├── viskom-next/                    # Frontend Next.js 16 (Landing / & Dashboard /dashboard)
    │   ├── DESIGN.md                   # Arah desain Warm Industrial Retail & log keputusan visual
    │   └── app/                        # Komponen halaman utama dan ruang kerja dashboard
    └── viskom-backend/
        ├── preprocess.py               # Deteksi poligon rak, matriks H/H⁻¹, ROI LAB-CLAHE, Sobel-Y rails
        ├── main.py                     # API FastAPI (/api/presets & /api/analyze)
        └── requirements.txt            # Dependensi backend Python
```

## Cara Menjalankan

### 1. Backend (`http://127.0.0.1:8000`)

```bash
cd viskom-backend
venv\Scripts\activate
python -m uvicorn main:app --reload
```

Pastikan bobot produk `best_sku110k_yolo11s_960.pt` berada di dalam `viskom-backend/`. Jika kamu sudah melatih detektor sudut rak dari `shelfProject-shelf-quad-pose.ipynb`, salin juga `best_shelf_quad_yolo11n.pt` ke folder yang sama agar backend otomatis menggunakannya.

### 2. Frontend (`http://localhost:3000`)

```bash
cd viskom-next
npm install
npm run dev
```

Buka `http://localhost:3000` untuk halaman utama atau langsung ke `http://localhost:3000/dashboard` untuk ruang kerja inspeksi rak.
