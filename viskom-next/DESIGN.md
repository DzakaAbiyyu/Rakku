# DESIGN.md: Rakku (Warm Industrial Retail)

## Identity & Character
- **Product**: Rakku, sistem pemantauan keterisian rak ritel berbasis visi komputer dan geometri perspektif kamera toko/CCTV.
- **Direction**: Warm Industrial Retail. Terinspirasi dari material fisik minimarket dan gudang ritel: kertas label rak hangat, permukaan beton toko, rangka besi gondola arang, dan penanda stok vermilion/terakota kontras tinggi.
- **Audience**: Pengelola operasional toko ritel, staf lapangan pengguna tablet/ponsel, dan penguji akademik Visi Komputer.
- **Mood**: Taktil, terukur, jujur pada data optik, bebas gimik "AI futuristik" atau neon gelap generik.

## Dials
- **Landing (`/`)**: `Dial: ENERGY 2 / RHYTHM 3 / MOTION 1`
- **Dashboard (`/dashboard`)**: `Dial: ENERGY 2 / RHYTHM 2 / MOTION 1`

## Color System (WCAG AA Verified via `contrast-check.py`)

### Light Theme (Default: Store Daylight / Shelf Label Paper)
- `--bg-canvas`: `#F5F1EA` (latar halaman kertas/beton hangat)
- `--bg-surface`: `#FDFBF7` (permukaan panel dan kartu kerja)
- `--bg-muted`: `#EAE3D7` (blok pemisah struktural dan kontrol sekunder)
- `--fg-primary`: `#1C1917` (tinta arang utama; 15.53:1 di canvas, 16.92:1 di surface)
- `--fg-secondary`: `#4A433C` (teks pendukung; 8.64:1 di canvas, 7.63:1 di muted)
- `--border-subtle`: `#D6CEC2` (garis pembagi non-interaktif)
- `--border-strong`: `#736A60` (batas elemen interaktif; 5.13:1 di surface, 4.71:1 di canvas)
- `--accent`: `#B83B0A` (vermilion terakota untuk satu aksi utama/fokus; teks putih `#FFFFFF` di atasnya 5.73:1)
- `--accent-hover`: `#9A3007`
- `--status-ok`: `#166534` (baris aman; 6.90:1 di surface)
- `--status-alert`: `#B91C1C` (baris perlu restock; 6.26:1 di surface)

### Dark Theme (Toggleable: Night Shift / Camera Inspection Room)
- `--bg-canvas`: `#141210` (rangka besi gelap hangat)
- `--bg-surface`: `#1E1B18` (panel kontrol ruang kamera)
- `--bg-muted`: `#292521` (area sekunder)
- `--fg-primary`: `#F5F1EA` (16.60:1 di canvas, 15.22:1 di surface)
- `--fg-secondary`: `#C2B9AE` (9.65:1 di canvas, 7.85:1 di muted)
- `--border-subtle`: `#38322C`
- `--border-strong`: `#8C8277` (4.55:1 di surface, 4.96:1 di canvas)
- `--accent`: `#F97316` (tinta `#141210` di atas tombol aksen 6.67:1)
- `--accent-text`: `#FB923C` (teks aksen di surface gelap 7.57:1)
- `--status-ok`: `#4ADE80` (9.84:1 di surface gelap)
- `--status-alert`: `#F87171` (6.20:1 di surface gelap)

## Typography
- **Primary Sans (`Plus Jakarta Sans`)**: Dipilih karena keterbacaan tinggi pada teks antarmuka Bahasa Indonesia di layar kecil maupun lebar serta karakter humanis-industrial yang bersih tanpa terasa klon template teknologi Barat.
- **Technical Numeric Mono (`IBM Plex Mono`)**: Dipilih khusus untuk angka terukur (persentase isi rak, ID kamera `CAM-01..05`, koordinat poligon `(x, y)`, kode baris `B1..Bn`, dan latensi `ms`) agar angka tabular sejajar seperti cetakan label harga dan instrumen ukur.

## Identity Motif & Radius Scale
- **Identity Motif**: *Corner Sight-Marks & Price-Rail Ticket Structure*. Sudut siku bidik kamera (`L-brackets`) pada kanvas inspeksi rak serta pembagian informasi bergaya tiket rak fisik (header ringkas berbatas garis tegas 1px, angka monospasi terukur).
- **Border Radius Hierarchy**: `2px` untuk badge status teknis, `6px` untuk tombol dan input kontrol, `10px` untuk panel kerja utama (tanpa bentuk kapsul/`pill` seragam).

## Decision Log (R-31 One-Line Reasons)
- **Palette**: Kertas hangat `#F5F1EA`, tinta arang `#1C1917`, dan aksen terakota `#B83B0A` merepresentasikan label rak toko fisik serta memberi kontras tinggi di sekitar citra rak berwarna-warni.
- **Theme Toggle**: Mode terang memudahkan inspeksi lapangan di lorong toko yang terang, sedangkan mode gelap mengurangi silau saat memeriksa bayangan gelap citra kamera.
- **Typography**: `Plus Jakarta Sans` menjaga keterbacaan instruksi Bahasa Indonesia, sementara `IBM Plex Mono` menyelaraskan angka metrik dan koordinat piksel secara tabular.
- **Landing Composition (`RHYTHM 3`)**: Setiap seksi berganti struktur (hero asimetris dengan bukti citra nyata, pita spesifikasi metrik terverifikasi, diagram alur bernomor horizontal/staggered, lalu blok konteks akademik) agar mengikuti cerita produk, bukan kartu seragam.
- **Dashboard Layout (`RHYTHM 2`)**: Kanvas kamera dan keputusan baris mana yang perlu restock menjadi pusat layar, bukan deretan kartu statistik generik atau sidebar kosong.
- **Spacing & Mobile Reflow**: Tiga tata letak berbeda (1 kolom fokus kanvas di ponsel, 2 kolom seimbang di tablet, workspace 2-panel proporsional di desktop) dengan ruang sentuh minimal `44x44 px`.
