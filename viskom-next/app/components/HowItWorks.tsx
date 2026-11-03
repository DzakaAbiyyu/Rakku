import React from "react";

export default function HowItWorks() {
    const steps = [
        { num: "01", title: "Input Citra", desc: "Akuisisi / upload foto rak ritel." },
        { num: "02", title: "Perbaikan Citra", desc: "Resize, CLAHE & bilateral denoise." },
        { num: "03", title: "Deteksi Produk", desc: "Inference model YOLO11 (1 class)." },
        { num: "04", title: "Klaster Baris", desc: "Pengelompokan objek per baris rak." },
        { num: "05", title: "Hitung Celah", desc: "Deteksi gap > 1× lebar median produk." },
        { num: "06", title: "Estimasi Rasio", desc: "Kalkulasi % keterisian per baris." },
        { num: "07", title: "Output Sistem", desc: "Visualisasi anotasi, % & flag restock.", active: true },
    ];

    return (
        <section id="cara-kerja"
            className="py-16 bg-[#F2F4F7] scroll-mt-20">
            <div
                className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="text-center mb-10">
                    <h2 className="text-3xl sm:text-4xl font-black text-[#0B1354] tracking-tight mb-2">
                        Cara Kerja Sistem
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base">
                        Alur pemrosesan citra dari foto mentah hingga analisis keterisian rak
                    </p>
                </div>

                {/* Grid 7 Tahap (Compact & Clean) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                    {steps.map((s) => (
                        <div
                            key={s.num}
                            className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${s.active
                                ? "bg-[#0B1354] border-[#0B1354] text-white shadow-md"
                                : "bg-white border-slate-200 text-[#0B1354]"
                                }`}
                        >
                            {/* Badge Tahap */}
                            <div className="mb-3">
                                <span
                                    className={`text-[10px] font-black px-2.5 py-1 rounded tracking-wider ${s.active
                                        ? "bg-[#F5D010] text-[#0B1354]"
                                        : "bg-[#0B1354] text-white"
                                        }`}
                                >
                                    TAHAP {s.num}
                                </span>
                            </div>

                            {/* Title & Description */}
                            <div>
                                <h3 className={`font-bold text-base mb-1 ${s.active ? "text-white" : "text-[#0B1354]"}`}>
                                    {s.title}
                                </h3>
                                <p className={`text-xs leading-relaxed ${s.active ? "text-slate-200" : "text-slate-600"}`}>
                                    {s.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>



            </div>
        </section>
    );
}