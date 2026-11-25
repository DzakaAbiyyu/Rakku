export default function HowItWorks() {
  const stages = [
    {
      code: '01',
      title: 'Isolasi Poligon 4 Sudut Rak',
      detail:
        'Sistem memisahkan bidang rak utama dari lantai keramik, keranjang gantung samping, dan rak lorong belakang menggunakan detektor sudut rak (YOLO11n-pose / LSD-RANSAC lokal) atau kalibrasi 4 titik.',
      spec: 'Output: koordinat [TL, TR, BR, BL]',
    },
    {
      code: '02',
      title: 'Potong ROI Tajam & Angkat Bayangan Lokal',
      detail:
        'Kecerahan diukur khusus di dalam poligon rak (persentil bawah P25), sehingga lampu neon plafon tidak menipu sensor. Bila rak bawah gelap, LAB L-Channel CLAHE dan Bilateral Filter diterapkan.',
      spec: 'Aktif otomatis saat ROI mean < 95 atau P25 < 58',
    },
    {
      code: '03',
      title: 'Deteksi Kemasan 3D pada Piksel Asli',
      detail:
        'Berbeda dari image-warping klasik yang membuat kardus dan botol 3D tertarik miring serta ujung jauh menjadi blur, inferensi YOLO11s@960 dijalankan langsung pada potongan ROI asli yang tajam.',
      spec: 'Filter otomatis label harga kecil di bibir rak',
      featured: true,
    },
    {
      code: '04',
      title: 'Coordinate-Space Homography & Proyeksi Balik',
      detail:
        'Titik tumpu bawah tiap produk dipetakan ke bidang metrik datar memakai matriks H untuk mengelompokkan baris dan mengukur lebar celah tanpa bias dekat-jauh, lalu diproyeksikan balik (H⁻¹) ke layar kamera.',
      spec: 'Akurat untuk sudut kamera miring maupun frontal',
    },
  ];

  return (
    <section id="arsitektur" className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Narrative Column */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
            <p className="font-tabular text-xs font-semibold text-[var(--accent-text)]">
              ARSITEKTUR PEMROSESAN CITRA
            </p>
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold tracking-tight leading-tight text-[var(--fg-primary)]">
              Kenapa Memetakan Koordinat Lebih Akurat daripada Melengkungkan Gambar?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[var(--fg-secondary)]">
              Transformasi homografi bekerja pada bidang datar 2D, sedangkan kemasan di atas rak memiliki ketebalan 3D. Melengkungkan seluruh gambar sebelum deteksi objek pada sudut kamera tinggi menurunkan ketajaman piksel dan mendistorsi bentuk kemasan.
            </p>
            <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-muted)] space-y-1.5">
              <p className="text-xs font-bold text-[var(--fg-primary)]">
                Prinsip Coordinate-Space Homography
              </p>
              <p className="text-xs leading-relaxed text-[var(--fg-secondary)]">
                Detektor membaca piksel asli yang utuh, sementara perhitungan geometri baris dan lebar celah kosong dinormalisasi di ruang metrik 2D menggunakan matriks transformasi perspektif.
              </p>
            </div>
          </div>

          {/* Right Numbered Technical Ledger */}
          <ol className="lg:col-span-7 divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[10px] bg-[var(--bg-canvas)] overflow-hidden">
            {stages.map((stage) => (
              <li
                key={stage.code}
                className={`p-5 sm:p-6 flex flex-col sm:flex-row gap-4 ${
                  stage.featured ? 'bg-[var(--bg-surface)]' : ''
                }`}
              >
                <div className="shrink-0">
                  <span
                    className={`font-tabular inline-flex items-center justify-center w-10 h-10 rounded-[6px] text-sm font-semibold border ${
                      stage.featured
                        ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]'
                        : 'bg-[var(--bg-muted)] text-[var(--fg-primary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {stage.code}
                  </span>
                </div>
                <div className="space-y-2 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--fg-primary)]">
                    {stage.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--fg-secondary)]">
                    {stage.detail}
                  </p>
                  <p className="font-tabular text-xs font-medium text-[var(--fg-secondary)] pt-1">
                    {stage.spec}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
