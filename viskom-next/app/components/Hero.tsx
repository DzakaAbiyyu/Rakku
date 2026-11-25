import Link from 'next/link';

export default function Hero() {
  return (
    <section className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Core Problem & Action */}
          <div className="lg:col-span-7 space-y-5">
            <h1 className="text-[clamp(1.85rem,4.2vw,3.35rem)] font-extrabold tracking-tight leading-[1.12] text-[var(--fg-primary)]">
              Pantau Keterisian Rak dari Sudut Kamera Toko tanpa Merusak Bentuk Produk
            </h1>

            <p className="text-base sm:text-lg leading-relaxed text-[var(--fg-secondary)] max-w-2xl">
              Kamera pengawas lorong ritel memotret rak secara miring dan menangkap lantai maupun rak sebelah. Rakku mengisolasi poligon 4 sudut rak, mendeteksi kemasan langsung pada piksel tajam dengan YOLO11s, lalu menghitung celah kosong di ruang metrik melalui Coordinate-Space Homography.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="min-h-[46px] inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-bold text-sm transition-colors"
              >
                <span>Buka Dashboard Inspeksi</span>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                </svg>
              </Link>

              <a
                href="#arsitektur"
                className="min-h-[46px] inline-flex items-center justify-center px-5 py-3 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)] text-[var(--fg-primary)] font-semibold text-sm transition-colors"
              >
                Pelajari Alur Geometri
              </a>
            </div>
          </div>

          {/* Right Column: Optical Sight-Mark Diagram of Coordinate-Space Homography */}
          <div className="lg:col-span-5">
            <div className="sight-frame rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--border-subtle)]">
                <span className="font-tabular text-xs font-semibold text-[var(--fg-primary)]">
                  CAM-01 · ENDCAP 27.5°
                </span>
                <span className="font-tabular text-xs font-semibold px-2 py-0.5 rounded-[2px] bg-[var(--status-alert-bg)] text-[var(--status-alert)]">
                  2 BARIS RESTOCK
                </span>
              </div>

              <svg
                viewBox="0 0 420 270"
                role="img"
                aria-label="Ilustrasi pemetaan poligon rak miring ke baris metrik datar"
                className="w-full h-auto rounded-[6px] bg-[#181512] border border-[var(--border-subtle)]"
              >
                {/* Perspective floor lines ignored outside ROI */}
                <line x1="0" y1="220" x2="130" y2="270" stroke="#38322C" strokeWidth="1" />
                <line x1="290" y1="225" x2="420" y2="265" stroke="#38322C" strokeWidth="1" />

                {/* 4-corner Shelf ROI Quad */}
                <polygon
                  points="76,34 334,54 308,236 92,248"
                  fill="rgba(249,115,22,0.08)"
                  stroke="#FB923C"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />

                {/* Tilted Shelf Rails */}
                <line x1="80" y1="96" x2="327" y2="109" stroke="#8C8277" strokeWidth="2" />
                <line x1="85" y1="168" x2="318" y2="174" stroke="#8C8277" strokeWidth="2" />
                <line x1="91" y1="238" x2="309" y2="233" stroke="#8C8277" strokeWidth="2" />

                {/* Row 1: Full products */}
                <rect x="92" y="48" width="44" height="46" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="142" y="51" width="44" height="45" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="192" y="54" width="46" height="45" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="244" y="58" width="42" height="44" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="291" y="61" width="30" height="43" fill="none" stroke="#4ADE80" strokeWidth="1.8" />

                {/* Row 2: Products + Perspective Empty Gap Polygon */}
                <rect x="95" y="116" width="46" height="49" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <polygon
                  points="147,114 256,119 253,169 146,166"
                  fill="rgba(248,113,113,0.28)"
                  stroke="#F87171"
                  strokeWidth="1.8"
                />
                <text x="169" y="145" fill="#FCA5A5" fontSize="11" fontFamily="monospace" fontWeight="600">
                  GAP 3 SLOT
                </text>
                <rect x="262" y="122" width="48" height="47" fill="none" stroke="#4ADE80" strokeWidth="1.8" />

                {/* Row 3: Full products */}
                <rect x="98" y="184" width="38" height="50" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="141" y="184" width="38" height="49" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="184" y="183" width="40" height="49" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="229" y="183" width="36" height="48" fill="none" stroke="#4ADE80" strokeWidth="1.8" />
                <rect x="270" y="182" width="34" height="47" fill="none" stroke="#4ADE80" strokeWidth="1.8" />

                {/* 4 Corner Handles TL, TR, BR, BL */}
                {[
                  [76, 34, 'TL'],
                  [334, 54, 'TR'],
                  [308, 236, 'BR'],
                  [92, 248, 'BL'],
                ].map(([cx, cy, lbl]) => (
                  <g key={String(lbl)}>
                    <circle cx={Number(cx)} cy={Number(cy)} r="5.5" fill="#F97316" stroke="#141210" strokeWidth="1.5" />
                    <text
                      x={Number(cx) + (String(lbl).includes('R') ? 8 : -22)}
                      y={Number(cy) + (String(lbl).includes('B') ? 14 : -7)}
                      fill="#F5F1EA"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {lbl}
                    </text>
                  </g>
                ))}
              </svg>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fg-secondary)]">
                <span> Piksel kemasan tetap tajam (tanpa blur warp)</span>
                <span className="font-tabular font-semibold text-[var(--fg-primary)]">H: Kamera -&gt; Metrik 2D</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ruled Technical Specification Strip (Verified Notebook Metrics) */}
        <dl className="mt-12 pt-8 border-t border-[var(--border-subtle)] grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <dt className="text-xs font-semibold text-[var(--fg-secondary)]">mAP@50 Validasi SKU-110K</dt>
            <dd className="mt-1 font-tabular text-2xl sm:text-3xl font-semibold text-[var(--fg-primary)]">92.65%</dd>
            <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">Dievaluasi pada 588 citra uji padat</p>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--fg-secondary)]">Galat Estimasi Keterisian (MAE)</dt>
            <dd className="mt-1 font-tabular text-2xl sm:text-3xl font-semibold text-[var(--fg-primary)]">4.38%</dd>
            <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">Korelasi 0.909 terhadap box ground-truth</p>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--fg-secondary)]">Resolusi Deteksi ROI</dt>
            <dd className="mt-1 font-tabular text-2xl sm:text-3xl font-semibold text-[var(--fg-primary)]">960 px</dd>
            <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">YOLO11s dengan batas hingga 1000 objek</p>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--fg-secondary)]">Mode Koreksi Perspektif</dt>
            <dd className="mt-1 font-tabular text-2xl sm:text-3xl font-semibold text-[var(--fg-primary)]">H &amp; H⁻¹</dd>
            <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">Proyeksi titik tumpu tanpa distorsi 3D</p>
          </div>
        </dl>
      </div>
    </section>
  );
}
