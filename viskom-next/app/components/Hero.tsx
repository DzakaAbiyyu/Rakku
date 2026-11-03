

export default function Hero() {
    return (
        <section id="hero" className="pt-32 pb-16 bg-white text-center">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">



                {/* Main Title */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#0B1354] tracking-tight leading-[1.15] max-w-4xl mb-6">
                    Deteksi Keterisian Rak Otomatis dengan AI
                </h1>

                {/* Subtitle */}
                <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed mb-8">
                    Upload foto rak retail kamu, dan sistem kami akan mendeteksi produk, menghitung keterisian per baris, serta menandai baris yang perlu restock dalam hitungan detik.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
                    <a
                        href="#demo"
                        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#F5D010] hover:bg-yellow-400 text-[#0B1354] font-bold rounded-lg border border-[#0B1354] transition-colors"
                    >
                        Mulai Deteksi
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </a>

                    <a
                        href="#cara-kerja"
                        className="inline-flex items-center justify-center px-8 py-3.5 bg-[#F2F4F7] hover:bg-slate-200 text-[#0B1354] font-bold rounded-lg border border-[#0B1354] transition-colors"
                    >
                        Lihat Cara Kerja
                    </a>
                </div>

                {/* Divider */}
                <div className="w-full max-w-4xl border-t border-slate-200/80 mb-10" />

                {/* Stats Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl">
                    {/* Card 1 */}
                    <div className="bg-[#F2F4F7] border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col items-center justify-center">
                        <span className="text-2xl sm:text-3xl font-extrabold text-[#0B1354] mb-1">
                            98.4%
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-slate-600">
                            Akurasi Deteksi Produk
                        </span>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-[#F2F4F7] border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col items-center justify-center">
                        <span className="text-2xl sm:text-3xl font-extrabold text-[#0B1354] mb-1">
                            &lt; 1 Detik
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-slate-600">
                            Waktu Pemrosesan Citra
                        </span>
                    </div>

                    {/* Card 3 */}
                    <div className="bg-[#F2F4F7] border border-slate-200/80 rounded-xl p-5 sm:p-6 flex flex-col items-center justify-center">
                        <span className="text-2xl sm:text-3xl font-extrabold text-[#0B1354] mb-1">
                            YOLO11 + SAHI
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-slate-600">
                            Arsitektur Computer Vision
                        </span>
                    </div>
                </div>

            </div>
        </section>
    );
}