import Link from 'next/link';

export default function AboutSection() {
  const scenarios = [
    {
      cam: 'CAM-01 & CAM-02',
      title: 'Sudut Tinggi & Samping Endcap',
      desc: 'Membuang gangguan lantai keramik, lorong sebelah, serta keranjang kawat gantung di tiang samping agar tidak memicu celah kosong palsu.',
    },
    {
      cam: 'CAM-03',
      title: 'Bayangan Pekat pada Rak Bawah',
      desc: 'Mengukur distribusi intensitas di dalam batas rak saja, sehingga botol gelap di baris bawah tetap terangkat kontrasnya meski lampu plafon terang.',
    },
    {
      cam: 'UNGGAH MANDIRI',
      title: 'Multi-Gondola & Foto Rak Sendiri',
      desc: 'Mendeteksi sambungan tiang vertikal antar-unit gondola pada foto yang kamu unggah sendiri sehingga tiap zona rak dapat diperiksa terpisah.',
    },
  ];

  return (
    <section id="evaluasi" className="bg-[var(--bg-canvas)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 space-y-12">
        <div className="max-w-3xl space-y-3">
          <p className="font-tabular text-xs font-semibold text-[var(--accent-text)]">
            UJI KASUS MINIMARKET NYATA
          </p>
          <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold tracking-tight text-[var(--fg-primary)]">
            Dirancang untuk Kondisi Lorong Toko Sungguhan
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-[var(--fg-secondary)]">
            Tanpa perlu terhubung langsung ke perangkat perekam toko, dashboard menyediakan tiga preset kamera minimarket asli dengan tantangan sudut pandang dan pencahayaan berbeda, ditambah dukungan unggah foto mandiri maupun kamera ponsel/tablet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {scenarios.map((item) => (
            <article
              key={item.cam}
              className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <span className="font-tabular text-xs font-semibold text-[var(--accent-text)]">
                  {item.cam}
                </span>
                <h3 className="text-base font-bold text-[var(--fg-primary)]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--fg-secondary)]">{item.desc}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Action Banner to Separate /dashboard Route */}
        <div className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <h3 className="text-lg sm:text-xl font-extrabold text-[var(--fg-primary)]">
              Uji Langsung Preset Kamera Toko atau Unggah Foto Rak Sendiri
            </h3>
            <p className="text-sm text-[var(--fg-secondary)]">
              Buka halaman kerja untuk mencoba kalibrasi poligon 4 titik, membandingkan tampilan perspektif kamera dengan Planogram 2D, dan mengatur batas restock per baris.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="min-h-[46px] shrink-0 inline-flex items-center justify-center px-6 py-3 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-bold text-sm transition-colors"
          >
            Masuk ke Dashboard Inspeksi
          </Link>
        </div>

        <footer className="pt-8 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--fg-secondary)]">
          <p>
            Rakku · Proyek Visi Komputer &amp; Pemrosesan Citra (Dataset dasar: SKU-110K CVPR19, Model: Ultralytics YOLO11s &amp; OpenCV).
          </p>
          <div className="flex items-center gap-5 font-semibold">
            <a href="#arsitektur" className="min-h-[44px] inline-flex items-center hover:text-[var(--fg-primary)]">
              Alur Geometri
            </a>
            <Link href="/dashboard" className="min-h-[44px] inline-flex items-center hover:text-[var(--fg-primary)]">
              Dashboard
            </Link>
          </div>
        </footer>
      </div>
    </section>
  );
}
