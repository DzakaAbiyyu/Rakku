'use client'
import { useState, ChangeEvent } from 'react'

interface Row {
    id: number
    fill_percent: number
    products: number
    gap: number
    restock: boolean
}

interface Result {
    total_fill: number
    restock_rows: number
    rows: Row[]
}

export default function DemoSection() {
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [selectedSample, setSelectedSample] = useState<number | null>(null)
    const [slider, setSlider] = useState<number>(60)

    // Layer Visualisasi Toggles
    const [layers, setLayers] = useState({
        boxProduk: true,
        celahKosong: true,
        garisBaris: true,
    })

    // State Hasil Deteksi
    const [result, setResult] = useState<Result | null>({
        total_fill: 61,
        restock_rows: 2,
        rows: [
            { id: 1, fill_percent: 86, products: 13, gap: -1, restock: false },
            { id: 2, fill_percent: 48, products: 6, gap: -5.2, restock: true },
            { id: 3, fill_percent: 38, products: 5, gap: -6.8, restock: true },
            { id: 4, fill_percent: 72, products: 10, gap: -2.8, restock: false },
        ],
    })

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] ?? null
        setFile(selectedFile)
        setSelectedSample(null)
        if (selectedFile) {
            setPreviewUrl(URL.createObjectURL(selectedFile))
        }
    }

    const handleSelectSample = (sampleId: number) => {
        setSelectedSample(sampleId)
        setFile(null)
        // Contoh dummy image URL atau preview sampel
        setPreviewUrl('/sample-shelf.jpg')
    }

    const toggleLayer = (layerKey: keyof typeof layers) => {
        setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }))
    }

    const handleAnalyze = () => {
        // Logika pemrosesan/analisis AI
        setResult({
            total_fill: 61,
            restock_rows: 2,
            rows: [
                { id: 1, fill_percent: 86, products: 13, gap: -1.0, restock: false },
                { id: 2, fill_percent: 48, products: 6, gap: -5.2, restock: true },
                { id: 3, fill_percent: 38, products: 5, gap: -6.8, restock: true },
                { id: 4, fill_percent: 72, products: 10, gap: -2.8, restock: false },
            ],
        })
    }

    return (
        <section id="demo" className="py-12 bg-[#F2F4F7] min-h-screen scroll-mt-20 text-[#0B1354]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* ================= PANEL KIRI: CONTROL & UPLOAD ================= */}
                    <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">

                        {/* 1. Upload Foto Rak */}
                        <div>
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B1354] mb-3">
                                1. Upload Foto Rak
                            </h3>
                            <label
                                htmlFor="file-upload"
                                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50/50 hover:bg-gray-100 transition-colors text-center"
                            >
                                <svg
                                    className="w-8 h-8 text-slate-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                    />
                                </svg>
                                <span className="text-xs font-bold text-slate-700">
                                    Klik untuk memilih foto dari perangkat
                                </span>
                                <span className="text-[11px] text-gray-400 mt-1">
                                    Format: JPG, PNG, WEBP
                                </span>
                                <input
                                    id="file-upload"
                                    type="file"
                                    className="hidden"
                                    accept=".jpg, .jpeg, .png, .webp"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>

                        {/* Atau Pilih Sampel Foto */}


                        {/* Threshold Restock */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#0B1354]">
                                    Threshold Restock:
                                </span>
                                <span className="bg-[#F5D010] text-[#0B1354] font-extrabold px-2 py-0.5 rounded text-xs">
                                    {slider}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="80"
                                value={slider}
                                onChange={(e) => setSlider(parseInt(e.target.value))}
                                className="w-full accent-[#0B1354] cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-1">
                                <span>20% (Toleran)</span>
                                <span>50% (Standar)</span>
                                <span>80% (Kritis)</span>
                            </div>
                        </div>

                        {/* Layer Visualisasikan */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-[#0B1354] mb-2">
                                Layer Visualisasikan:
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => toggleLayer('boxProduk')}
                                    className={`py-2 rounded-lg text-xs font-bold text-center transition-all ${layers.boxProduk
                                        ? 'bg-[#0B1354] text-white shadow-sm'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                >
                                    Box Produk
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleLayer('celahKosong')}
                                    className={`py-2 rounded-lg text-xs font-bold text-center transition-all ${layers.celahKosong
                                        ? 'bg-red-600 text-white shadow-sm'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                >
                                    Celah Kosong
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleLayer('garisBaris')}
                                    className={`py-2 rounded-lg text-xs font-bold text-center transition-all ${layers.garisBaris
                                        ? 'bg-[#F5D010] text-[#0B1354] shadow-sm'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                >
                                    Garis Baris
                                </button>
                            </div>
                        </div>

                        {/* Tombol Deteksi */}
                        <button
                            type="button"
                            onClick={handleAnalyze}
                            className="w-full bg-[#F5D010] hover:bg-yellow-400 text-[#0B1354] font-extrabold text-xs py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2.5"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            JALANKAN DETEKSI AI
                        </button>
                    </div>

                    {/* ================= PANEL KANAN: HASIL DETEKSI ================= */}
                    <div className="lg:col-span-7 space-y-4">

                        {/* Box Header & Gambar Anotasi */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="bg-[#0B1354] px-4 py-3 flex justify-between items-center">
                                <span className="text-white font-extrabold text-xs tracking-wider uppercase">
                                    HASIL ANOTASI SISTEM
                                </span>
                                <span className="text-[#F5D010] font-bold text-xs">
                                    Model: YOLO11-SKU110K
                                </span>
                            </div>

                            {/* Area Tampilan Gambar */}
                            <div className="relative bg-gray-900 w-full aspect-[4/3] flex items-center justify-center overflow-hidden">
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="Preview Rak"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="text-gray-400 text-xs font-medium">
                                        Belum ada gambar terpilih
                                    </div>
                                )}
                            </div>

                            {/* Stats Bar Dibawah Gambar */}
                            {result && (
                                <div className="p-4 bg-white border-t border-gray-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-[#0B1354]">
                                            Total Keterisian Rak: <strong className="text-sm font-extrabold">{result.total_fill}%</strong>
                                        </span>
                                        <span className="bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded-md flex items-center gap-1 shadow-sm">
                                            ⚠️ {result.restock_rows} Baris Perlu Restock
                                        </span>
                                    </div>
                                    {/* Total Fill Progress Bar */}
                                    <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                                        <div
                                            className="bg-[#0B1354] h-full rounded-full transition-all duration-500"
                                            style={{ width: `${result.total_fill}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Grid Detail Hasil Per Baris */}
                        {result && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {result.rows.map((row) => (
                                    <div
                                        key={row.id}
                                        className={`bg-white rounded-xl p-4 border transition-all ${row.restock
                                            ? 'border-red-300 shadow-sm bg-red-50/10'
                                            : 'border-emerald-200 shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-[#0B1354] uppercase tracking-wider">
                                                BARIS {row.id}
                                            </span>
                                            <span
                                                className={`text-xs font-bold px-2 py-0.5 rounded ${row.restock
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-emerald-100 text-emerald-700'
                                                    }`}
                                            >
                                                {row.fill_percent}%
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-700 font-bold mb-2">
                                            {row.products} Produk Dideteksi
                                        </p>

                                        {/* Progress Bar per Baris */}
                                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mb-3">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${row.restock ? 'bg-red-600' : 'bg-[#0B1354]'
                                                    }`}
                                                style={{ width: `${row.fill_percent}%` }}
                                            />
                                        </div>

                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-gray-500 font-medium">
                                                Est. Celah: {row.gap} Slot
                                            </span>
                                            {row.restock && (
                                                <span className="text-red-600 font-bold flex items-center gap-0.5">
                                                    ⚠️ Perlu Restock
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </section>
    )
}