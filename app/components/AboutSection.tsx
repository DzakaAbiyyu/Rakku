export default function About() {
    return (
        <section id="about" className="py-16 bg-[#F2F4F7] scroll-mt-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
                <h1 className="text-3xl sm:text-4xl font-black text-[#0B1354] tracking-tight mb-2">
                    Tentang Rakku
                </h1>
                <p className="text-slate-600 text-sm sm:text-base">
                    Rakku adalah sistem deteksi keterisian rak retail berbasis Computer Vision dan AI. Sistem ini dirancang untuk membantu pengelola toko dalam memantau kondisi rak secara otomatis — mendeteksi produk, mengidentifikasi celah kosong, dan menandai baris yang perlu restock, hanya dengan mengunggah foto rak.
                </p>
            </div>
        </section>
    )
}