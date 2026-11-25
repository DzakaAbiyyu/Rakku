'use client'
import { useState, ChangeEvent } from 'react'

type BBox = [number, number, number, number]
type ClaheMode = 'auto' | 'on' | 'off'

interface Row {
    id: number
    products: number
    gap: number
    fill_percent: number
    bbox: BBox
}

interface PreprocessingMeta {
    orig_size: [number, number]
    proc_size: [number, number]
    resized: boolean
    denoise_applied: boolean
    clahe_mode: ClaheMode
    clahe_applied: boolean
    mean_before: number
    mean_after: number
    preprocess_ms: number
}

interface Result {
    model?: string
    image_width: number
    image_height: number
    total_products: number
    total_fill: number
    rows: Row[]
    boxes: BBox[]
    gaps: { row: number; bbox: BBox }[]
    preprocessing?: PreprocessingMeta
    preprocessed_image?: string
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function DemoSection() {
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [slider, setSlider] = useState<number>(60)

    // Opsi Pemrosesan Citra (Pre-YOLO)
    const [useDenoise, setUseDenoise] = useState<boolean>(true)
    const [claheMode, setClaheMode] = useState<ClaheMode>('auto')
    const [viewMode, setViewMode] = useState<'original' | 'preprocessed'>('original')

    // Layer Visualisasi Toggles
    const [layers, setLayers] = useState({
        boxProduk: true,
        celahKosong: true,
        garisBaris: true,
    })

    // State Hasil Deteksi
    const [result, setResult] = useState<Result | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const rows = (result?.rows ?? []).map((r) => ({ ...r, restock: r.fill_percent < slider }))
    const restockCount = rows.filter((r) => r.restock).length

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0] ?? null
        setFile(selected)
        setResult(null)
        setError(null)
        setViewMode('original')
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(selected ? URL.createObjectURL(selected) : null)
    }

    const toggleLayer = (layerKey: keyof typeof layers) => {
        setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }))
    }

    const handleAnalyze = async () => {
        if (!file) {
            setError('Pilih foto rak dulu')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const form = new FormData()
            form.append('file', file)
            form.append('use_denoise', String(useDenoise))
            form.append('clahe_mode', claheMode)
            form.append('return_preprocessed', 'true')
            const res = await fetch(`${API}/api/analyze`, { method: 'POST', body: form })
            if (!res.ok) {
                const err = await res.json().catch(() => null)
                throw new Error(err?.detail ?? `Error ${res.status}`)
            }
            setResult(await res.json())
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal menghubungi server')
        } finally {
            setLoading(false)
        }
    }

    const activeImageSrc =
        viewMode === 'preprocessed' && result?.preprocessed_image
            ? result.preprocessed_image
            : previewUrl

    const pre = result?.preprocessing

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
                                    {file ? file.name : 'Klik untuk memilih foto dari perangkat'}
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

                        {/* 2. Pemrosesan Citra (Pre-YOLO) */}
                        <div className="space-y-3 border-t border-gray-100 pt-4">
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B1354]">
                                2. Pemrosesan Citra (Pre-YOLO)
                            </h3>

                            {/* Bilateral Denoise Toggle */}
                            <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                                <div>
                                    <p className="text-xs font-bold text-[#0B1354]">Bilateral Denoise</p>
                                    <p className="text-[11px] text-gray-500">
                                        Reduksi noise sambil menjaga tepi produk
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setUseDenoise((prev) => !prev)}
                                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${useDenoise
                                        ? 'bg-[#0B1354] text-white'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                >
                                    {useDenoise ? 'Aktif' : 'Nonaktif'}
                                </button>
                            </div>

                            {/* CLAHE LAB Mode */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-[#0B1354]">CLAHE (LAB L-Channel)</p>
                                    <span className="text-[10px] font-semibold text-gray-500">
                                        {claheMode === 'auto'
                                            ? 'Otomatis jika gelap (mean < 65)'
                                            : claheMode === 'on'
                                                ? 'Selalu diterapkan'
                                                : 'Dinonaktifkan'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {([
                                        ['auto', 'Auto'],
                                        ['on', 'Aktif'],
                                        ['off', 'Mati'],
                                    ] as [ClaheMode, string][]).map(([mode, label]) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setClaheMode(mode)}
                                            className={`py-1.5 rounded-md text-xs font-bold transition-colors ${claheMode === mode
                                                ? 'bg-[#0B1354] text-white shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3. Threshold Restock */}
                        <div className="border-t border-gray-100 pt-4">
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
                            disabled={loading}
                            className="w-full bg-[#F5D010] hover:bg-yellow-400 disabled:opacity-60 text-[#0B1354] font-extrabold text-xs py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            <svg
                                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
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
                            {loading ? 'MEMPROSES...' : 'JALANKAN DETEKSI AI'}
                        </button>
                        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
                    </div>

                    {/* ================= PANEL KANAN: HASIL DETEKSI ================= */}
                    <div className="lg:col-span-7 space-y-4">

                        {/* Box Header & Gambar Anotasi */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="bg-[#0B1354] px-4 py-3 flex flex-wrap justify-between items-center gap-2">
                                <span className="text-white font-extrabold text-xs tracking-wider uppercase">
                                    HASIL ANOTASI SISTEM
                                </span>
                                <div className="flex items-center gap-2">
                                    {result?.preprocessed_image && (
                                        <div className="inline-flex rounded-md bg-white/10 p-0.5 text-[11px] font-bold">
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('original')}
                                                className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'original'
                                                    ? 'bg-[#F5D010] text-[#0B1354]'
                                                    : 'text-white hover:text-[#F5D010]'
                                                    }`}
                                            >
                                                Foto Asli
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('preprocessed')}
                                                className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'preprocessed'
                                                    ? 'bg-[#F5D010] text-[#0B1354]'
                                                    : 'text-white hover:text-[#F5D010]'
                                                    }`}
                                            >
                                                Hasil PC
                                            </button>
                                        </div>
                                    )}
                                    <span className="text-[#F5D010] font-bold text-xs">
                                        Model: {result?.model ?? 'YOLO11s-SKU110K@960'}
                                    </span>
                                </div>
                            </div>

                            {/* Area Tampilan Gambar */}
                            <div className="bg-gray-900 w-full min-h-48 flex items-center justify-center p-2">
                                {activeImageSrc ? (
                                    <div className="relative inline-block">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={activeImageSrc}
                                            alt={viewMode === 'preprocessed' ? 'Preview Rak Preprocessed' : 'Preview Rak'}
                                            className="block w-auto h-auto max-w-full max-h-[70vh]"
                                        />
                                        {result && (
                                            <svg
                                                viewBox={`0 0 ${result.image_width} ${result.image_height}`}
                                                preserveAspectRatio="none"
                                                className="absolute inset-0 w-full h-full"
                                            >
                                                {layers.boxProduk &&
                                                    result.boxes.map(([x1, y1, x2, y2], i) => (
                                                        <rect key={`b${i}`} x={x1} y={y1} width={x2 - x1} height={y2 - y1}
                                                            fill="none" stroke="#22c55e" strokeWidth={1.5}
                                                            vectorEffect="non-scaling-stroke" />
                                                    ))}
                                                {layers.celahKosong &&
                                                    result.gaps.map(({ bbox: [x1, y1, x2, y2] }, i) => (
                                                        <rect key={`g${i}`} x={x1} y={y1} width={x2 - x1} height={y2 - y1}
                                                            fill="rgba(220,38,38,0.25)" stroke="#dc2626" strokeWidth={1.5}
                                                            vectorEffect="non-scaling-stroke" />
                                                    ))}
                                                {layers.garisBaris &&
                                                    result.rows.map(({ id, bbox: [x1, y1, x2, y2] }) => (
                                                        <g key={`r${id}`}>
                                                            <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1}
                                                                fill="none" stroke="#F5D010" strokeWidth={2}
                                                                strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                                                            <text x={x1 + 6} y={y1 + 18} fill="#F5D010"
                                                                fontSize={Math.max(14, result.image_height / 40)} fontWeight="bold">
                                                                B{id}
                                                            </text>
                                                        </g>
                                                    ))}
                                            </svg>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-gray-400 text-xs font-medium py-16">
                                        Belum ada gambar terpilih
                                    </div>
                                )}
                            </div>

                            {/* Info Status Pemrosesan Citra */}
                            {pre && (
                                <div className="px-4 py-2.5 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center gap-2 text-[11px]">
                                    <span className="font-extrabold text-[#0B1354] uppercase tracking-wider">
                                        Pemrosesan Citra:
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                                        {pre.resized
                                            ? `Resize ${pre.orig_size[0]}×${pre.orig_size[1]} → ${pre.proc_size[0]}×${pre.proc_size[1]}`
                                            : `Resolusi ${pre.orig_size[0]}×${pre.orig_size[1]}`}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded font-semibold ${pre.denoise_applied
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        Bilateral: {pre.denoise_applied ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded font-semibold ${pre.clahe_applied
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        {pre.clahe_applied
                                            ? `CLAHE (LAB): Aktif (mean ${pre.mean_before} → ${pre.mean_after})`
                                            : pre.clahe_mode === 'auto'
                                                ? `Auto-CLAHE: Skip (terang, mean ${pre.mean_before})`
                                                : 'CLAHE: Nonaktif'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-[#0B1354]/10 text-[#0B1354] font-bold">
                                        {pre.preprocess_ms} ms
                                    </span>
                                </div>
                            )}

                            {/* Stats Bar Dibawah Gambar */}
                            {result && (
                                <div className="p-4 bg-white border-t border-gray-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-[#0B1354]">
                                            Total Keterisian Rak: <strong className="text-sm font-extrabold">{result.total_fill}%</strong>
                                        </span>
                                        <span className={`text-white text-[11px] font-bold px-3 py-1 rounded-md flex items-center gap-1 shadow-sm ${restockCount > 0 ? 'bg-red-600' : 'bg-emerald-600'
                                            }`}>
                                            {restockCount > 0 ? `⚠️ ${restockCount} Baris Perlu Restock` : '✅ Semua Baris Aman'}
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
                                {rows.map((row) => (
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
