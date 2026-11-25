'use client';

import { ChangeEvent, KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';

type BBox = [number, number, number, number];
type Point2D = [number, number];
type ClaheMode = 'auto' | 'on' | 'off';
type ViewStage = 'camera' | 'planogram' | 'clahe';

interface PresetCamera {
  id: string;
  code: string;
  name: string;
  scenario: string;
  angle_note: string;
  image_url: string;
}

interface ShelfRow {
  id: number;
  products: number;
  gap: number;
  coverage_percent: number;
  fill_percent: number;
  bbox: BBox;
  poly: Point2D[];
  rect_bbox: BBox;
}

interface ShelfGap {
  row: number;
  slots: number;
  bbox: BBox;
  poly: Point2D[];
  rect_bbox: BBox;
}

interface CandidateBay {
  id: number;
  label: string;
  quad: Point2D[];
}

interface PreprocessingMeta {
  orig_size: [number, number];
  proc_size: [number, number];
  roi_size: [number, number];
  resized: boolean;
  homography_mode: string;
  quad_source: string;
  rectify_enabled: boolean;
  rectify_applied: boolean;
  rectify_reason: string;
  rectify_angle_deg: number;
  rectify_quad: Point2D[] | null;
  denoise_applied: boolean;
  clahe_mode: ClaheMode;
  clahe_applied: boolean;
  mean_before: number;
  p25_before: number;
  mean_after: number;
  hist_before: number[];
  hist_after: number[];
  rail_peaks_y: number[];
  preprocess_ms: number;
  inference_ms: number;
  total_ms: number;
}

interface AnalyzeResult {
  model: string;
  shelf_detector: string;
  image_width: number;
  image_height: number;
  planogram_width: number;
  planogram_height: number;
  total_products: number;
  total_gap_slots: number;
  total_fill: number;
  price_tags_filtered: number;
  rows: ShelfRow[];
  boxes: BBox[];
  rect_boxes: BBox[];
  gaps: ShelfGap[];
  candidate_bays: CandidateBay[];
  preprocessing: PreprocessingMeta;
  preprocessed_image?: string;
  planogram_image?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const CORNER_LABELS = ['TL (Kiri-Atas)', 'TR (Kanan-Atas)', 'BR (Kanan-Bawah)', 'BL (Kiri-Bawah)'];
const CORNER_SHORT = ['TL', 'TR', 'BR', 'BL'];

export default function DashboardClient() {
  const [presets, setPresets] = useState<PresetCamera[]>([]);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  // Source state
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Pipeline parameters
  const [useRectify, setUseRectify] = useState<boolean>(true);
  const [useDenoise, setUseDenoise] = useState<boolean>(true);
  const [claheMode, setClaheMode] = useState<ClaheMode>('auto');
  const [confThreshold, setConfThreshold] = useState<number>(0.25);
  const [restockThreshold, setRestockThreshold] = useState<number>(65);

  // Visualization & Calibration state
  const [viewStage, setViewStage] = useState<ViewStage>('camera');
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [detectedBays, setDetectedBays] = useState<CandidateBay[]>([]);
  const [activeBayId, setActiveBayId] = useState<number>(1);
  const [calibrating, setCalibrating] = useState<boolean>(false);
  const [draftQuad, setDraftQuad] = useState<Point2D[] | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<number | null>(null);
  const [activeCornerIdx, setActiveCornerIdx] = useState<number>(0);

  const [layers, setLayers] = useState({
    produk: true,
    celah: true,
    baris: true,
    poligonRak: true,
  });

  // Execution state
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch available store camera presets on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/presets`);
        if (!res.ok) throw new Error('Server belum merespons');
        const data = await res.json();
        if (!cancelled) {
          setPresets(data.presets ?? []);
          setApiOnline(true);
        }
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const runAnalysis = useCallback(
    async (opts?: {
      presetId?: string | null;
      file?: File | null;
      customQuad?: Point2D[] | null;
      rectifyOverride?: boolean;
      denoiseOverride?: boolean;
      claheOverride?: ClaheMode;
      confOverride?: number;
    }) => {
      const targetPreset = opts?.presetId !== undefined ? opts.presetId : activePresetId;
      const targetFile = opts?.file !== undefined ? opts.file : uploadedFile;

      if (!targetPreset && !targetFile) {
        setError('Pilih salah satu kamera toko (CAM-01 s.d. CAM-03) atau unggah foto rak terlebih dahulu.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const form = new FormData();
        if (targetPreset) {
          form.append('preset_id', targetPreset);
        } else if (targetFile) {
          form.append('file', targetFile);
        }

        form.append('use_rectify', String(opts?.rectifyOverride ?? useRectify));
        form.append('use_denoise', String(opts?.denoiseOverride ?? useDenoise));
        form.append('clahe_mode', opts?.claheOverride ?? claheMode);
        form.append('conf_threshold', String(opts?.confOverride ?? confThreshold));
        form.append('return_preprocessed', 'true');

        if (opts?.customQuad) {
          form.append('custom_quad', JSON.stringify(opts.customQuad));
        }

        const res = await fetch(`${API}/api/analyze`, { method: 'POST', body: form });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.detail ?? `Permintaan gagal dengan kode ${res.status}`);
        }
        const data: AnalyzeResult = await res.json();
        setResult(data);
        setApiOnline(true);
        setSelectedRowId(null);
        if (!opts?.customQuad) {
          setDetectedBays(data.candidate_bays ?? []);
        }
        if (data.preprocessing.rectify_quad) {
          setDraftQuad(data.preprocessing.rectify_quad);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Tidak dapat terhubung ke server backend di port 8000. Pastikan FastAPI sedang berjalan.'
        );
      } finally {
        setLoading(false);
      }
    },
    [activePresetId, uploadedFile, useRectify, useDenoise, claheMode, confThreshold]
  );

  const handleSelectPreset = (preset: PresetCamera) => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setUploadedFile(null);
    setActivePresetId(preset.id);
    setActiveBayId(1);
    setCalibrating(false);
    setViewStage('camera');
    void runAnalysis({ presetId: preset.id, file: null, customQuad: null });
  };

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!picked) return;
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const nextUrl = URL.createObjectURL(picked);
    setLocalPreviewUrl(nextUrl);
    setUploadedFile(picked);
    setActivePresetId(null);
    setActiveBayId(1);
    setCalibrating(false);
    setViewStage('camera');
    void runAnalysis({ presetId: null, file: picked, customQuad: null });
  };

  const handleResetWorkspace = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setUploadedFile(null);
    setActivePresetId(null);
    setResult(null);
    setDetectedBays([]);
    setError(null);
    setCalibrating(false);
    setSelectedRowId(null);
  };

  const handleSelectBay = (bay: CandidateBay) => {
    setActiveBayId(bay.id);
    setDraftQuad(bay.quad);
    setCalibrating(false);
    void runAnalysis({ customQuad: bay.quad });
  };

  // Pointer drag for 4-corner CCTV zone calibration
  const clientToImageCoords = (clientX: number, clientY: number): Point2D | null => {
    if (!svgRef.current || !result) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(0, Math.min(result.image_width, ((clientX - rect.left) / rect.width) * result.image_width));
    const y = Math.max(0, Math.min(result.image_height, ((clientY - rect.top) / rect.height) * result.image_height));
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (draggingCorner === null || !draftQuad) return;
    const pt = clientToImageCoords(e.clientX, e.clientY);
    if (!pt) return;
    setDraftQuad((prev) => {
      if (!prev) return prev;
      const next = [...prev] as Point2D[];
      next[draggingCorner] = pt;
      return next;
    });
  };

  // Keyboard fallback for 4-corner calibration (WCAG R-32)
  const handleCornerKeyDown = (idx: number, e: KeyboardEvent<HTMLButtonElement>) => {
    if (!draftQuad || !result) return;
    const step = e.shiftKey ? 18 : 6;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else return;

    e.preventDefault();
    setActiveCornerIdx(idx);
    setDraftQuad((prev) => {
      if (!prev) return prev;
      const next = [...prev] as Point2D[];
      next[idx] = [
        Math.max(0, Math.min(result.image_width, Math.round((next[idx][0] + dx) * 10) / 10)),
        Math.max(0, Math.min(result.image_height, Math.round((next[idx][1] + dy) * 10) / 10)),
      ];
      return next;
    });
  };

  const activePreset = presets.find((p) => p.id === activePresetId) ?? null;
  const rawImageSrc = activePreset ? `${API}${activePreset.image_url}` : localPreviewUrl;

  const displayImageSrc =
    viewStage === 'planogram' && result?.planogram_image
      ? result.planogram_image
      : viewStage === 'clahe' && result?.preprocessed_image
        ? result.preprocessed_image
        : rawImageSrc;

  const isPlanogramView = viewStage === 'planogram' && Boolean(result?.planogram_image);
  const svgWidth = isPlanogramView ? (result?.planogram_width ?? 1) : (result?.image_width ?? 1);
  const svgHeight = isPlanogramView ? (result?.planogram_height ?? 1) : (result?.image_height ?? 1);

  const annotatedRows = (result?.rows ?? []).map((r) => ({
    ...r,
    needsRestock: r.fill_percent < restockThreshold,
  }));
  const restockCount = annotatedRows.filter((r) => r.needsRestock).length;
  const pre = result?.preprocessing;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5">
      {/* ================= TOP SOURCE BAR: PRESET CAMERAS + UPLOAD / MOBILE CAMERA ================= */}
      <section
        aria-label="Pemilih sumber citra kamera toko"
        className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-extrabold text-[var(--fg-primary)]">
              Ruang Inspeksi Keterisian Rak
            </h1>
            {apiOnline !== null && (
              <span
                className={`inline-flex items-center gap-1.5 font-tabular text-[11px] font-semibold px-2 py-0.5 rounded-[2px] ${
                  apiOnline
                    ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok)]'
                    : 'bg-[var(--status-alert-bg)] text-[var(--status-alert)]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiOnline ? 'bg-[var(--status-ok)]' : 'bg-[var(--status-alert)]'
                  }`}
                  aria-hidden="true"
                />
                {apiOnline ? 'API Aktif' : 'API Offline'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Standard File Upload */}
            <label className="min-h-[44px] px-3.5 inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)] text-xs font-bold text-[var(--fg-primary)] cursor-pointer transition-colors">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m-4-4l4-4 4 4" />
              </svg>
              <span>Unggah Foto</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFilePicked}
                className="sr-only"
              />
            </label>

            {/* Direct Phone/Tablet Rear Camera Capture */}
            <label className="min-h-[44px] px-3.5 inline-flex sm:hidden md:inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)] text-xs font-bold text-[var(--fg-primary)] cursor-pointer transition-colors">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                <circle cx="12" cy="12.5" r="3.2" />
              </svg>
              <span>Kamera Perangkat</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFilePicked}
                className="sr-only"
              />
            </label>

            {(activePresetId || uploadedFile) && (
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="min-h-[44px] px-3 inline-flex items-center rounded-[6px] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-muted)] cursor-pointer"
              >
                Kosongkan
              </button>
            )}
          </div>
        </div>

        {/* Preset Store Camera Strip */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {presets.map((cam) => {
            const selected = activePresetId === cam.id;
            return (
              <button
                key={cam.id}
                type="button"
                onClick={() => handleSelectPreset(cam)}
                disabled={loading}
                className={`min-h-[48px] shrink-0 px-3.5 py-2 rounded-[6px] border text-left transition-colors cursor-pointer ${
                  selected
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                    : 'border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-muted)] text-[var(--fg-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-tabular text-xs font-bold">{cam.code}</span>
                  <span className={`text-[11px] font-medium ${selected ? 'opacity-90' : 'text-[var(--fg-secondary)]'}`}>
                    {cam.scenario}
                  </span>
                </div>
                <p className="text-xs font-semibold truncate max-w-[210px]">{cam.name}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= MAIN WORKSPACE: 3-STATE REFLOW (MOBILE -> TABLET -> DESKTOP) ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT / TOP ZONE (7 cols on Desktop): INTERACTIVE OPTICAL VIEWPORT */}
        <section
          aria-label="Kanvas anotasi citra rak"
          className="xl:col-span-7 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
        >
          {/* Viewport Mode & Zone Header */}
          <div className="p-3 sm:p-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Mode tampilan citra">
              {(
                [
                  ['camera', 'Perspektif Kamera'],
                  ['planogram', 'Planogram 2D'],
                  ['clahe', 'Citra CLAHE'],
                ] as [ViewStage, string][]
              ).map(([stage, label]) => (
                <button
                  key={stage}
                  type="button"
                  role="tab"
                  aria-selected={viewStage === stage}
                  disabled={!result && stage !== 'camera'}
                  onClick={() => {
                    setViewStage(stage);
                    if (stage !== 'camera') setCalibrating(false);
                  }}
                  className={`min-h-[44px] px-3 rounded-[6px] text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    viewStage === stage
                      ? 'bg-[var(--fg-primary)] text-[var(--bg-surface)]'
                      : 'border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--fg-primary)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {result && viewStage === 'camera' && useRectify && (
              <button
                type="button"
                onClick={() => {
                  setCalibrating((prev) => !prev);
                  if (!draftQuad && pre?.rectify_quad) {
                    setDraftQuad(pre.rectify_quad);
                  }
                }}
                className={`min-h-[44px] px-3 rounded-[6px] text-xs font-bold border transition-colors cursor-pointer ${
                  calibrating
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                    : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {calibrating ? 'Selesai Kalibrasi' : 'Kalibrasi 4 Sudut'}
              </button>
            )}
          </div>

          {/* Multi-Bay Gondola Selector when multiple bays are detected (e.g. CAM-04) */}
          {result && detectedBays.length > 1 && (
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-muted)] flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--fg-primary)]">
                Unit Gondola Terdeteksi:
              </span>
              {detectedBays.map((bay) => (
                <button
                  key={bay.id}
                  type="button"
                  onClick={() => handleSelectBay(bay)}
                  disabled={loading}
                  className={`min-h-[40px] px-3 rounded-[6px] text-xs font-bold border cursor-pointer ${
                    activeBayId === bay.id
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                  }`}
                >
                  {bay.label}
                </button>
              ))}
            </div>
          )}

          {/* Calibration Toolbar (Pointer + Accessible Keyboard Nudging) */}
          {calibrating && draftQuad && viewStage === 'camera' && (
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-muted)] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--fg-primary)]">
                  Geser titik sudut di gambar, atau fokuskan tombol sudut di bawah lalu tekan tombol panah keyboard (Shift + Panah untuk geser cepat).
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCalibrating(false);
                      void runAnalysis({ customQuad: draftQuad });
                    }}
                    disabled={loading}
                    className="min-h-[44px] px-3.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer"
                  >
                    Terapkan Zona Rak
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalibrating(false);
                      void runAnalysis({ customQuad: null });
                    }}
                    disabled={loading}
                    className="min-h-[44px] px-3 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--fg-primary)] cursor-pointer"
                  >
                    Deteksi Otomatis
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {draftQuad.map(([qx, qy], idx) => (
                  <button
                    key={CORNER_SHORT[idx]}
                    type="button"
                    onClick={() => setActiveCornerIdx(idx)}
                    onKeyDown={(e) => handleCornerKeyDown(idx, e)}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-[6px] border text-left font-tabular text-[11px] cursor-pointer ${
                      activeCornerIdx === idx
                        ? 'border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--fg-primary)] font-bold'
                        : 'border-[var(--border-strong)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)]'
                    }`}
                  >
                    <span className="block font-bold text-[var(--fg-primary)]">{CORNER_LABELS[idx]}</span>
                    <span>
                      ({Math.round(qx)}, {Math.round(qy)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner (Explicit State R-27) */}
          {error && (
            <div
              role="alert"
              className="m-4 p-4 rounded-[8px] border border-[var(--status-alert)] bg-[var(--status-alert-bg)] text-[var(--status-alert)] flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-0.5 text-xs sm:text-sm font-semibold">
                <p>Gagal memproses citra rak</p>
                <p className="font-normal">{error}</p>
              </div>
              {(activePresetId || uploadedFile) && (
                <button
                  type="button"
                  onClick={() => void runAnalysis()}
                  className="min-h-[44px] px-3.5 rounded-[6px] border border-[var(--status-alert)] bg-[var(--bg-surface)] text-[var(--fg-primary)] text-xs font-bold cursor-pointer"
                >
                  Coba Lagi
                </button>
              )}
            </div>
          )}

          {/* Canvas Body: Empty / Loading / Annotated Image */}
          <div className="sight-frame bg-[var(--viewport-bg)] min-h-[300px] sm:min-h-[420px] flex items-center justify-center p-2 sm:p-4 relative">
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center p-6 text-center gap-3"
              >
                <div className="w-8 h-8 rounded-full border-2 border-[#F5F1EA]/30 border-t-[#F97316] animate-spin" aria-hidden="true" />
                <p className="text-sm font-bold text-[#F5F1EA]">
                  Mendeteksi produk pada potongan ROI dan memetakan homografi koordinat...
                </p>
              </div>
            )}

            {displayImageSrc ? (
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayImageSrc}
                  alt={
                    activePreset
                      ? `${activePreset.code} ${activePreset.name}`
                      : 'Citra rak yang sedang diinspeksi'
                  }
                  className="block w-auto h-auto max-w-full max-h-[68vh] select-none"
                />

                {result && (
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    preserveAspectRatio="none"
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => setDraggingCorner(null)}
                    onPointerLeave={() => setDraggingCorner(null)}
                    className={`absolute inset-0 w-full h-full ${calibrating ? 'touch-none' : ''}`}
                  >
                    {/* Shelf 4-Corner ROI Boundary in Camera View */}
                    {!isPlanogramView && layers.poligonRak && (draftQuad ?? pre?.rectify_quad) && (
                      <polygon
                        points={(calibrating && draftQuad ? draftQuad : pre?.rectify_quad ?? [])
                          .map(([x, y]) => `${x},${y}`)
                          .join(' ')}
                        fill={calibrating ? 'rgba(249,115,22,0.10)' : 'none'}
                        stroke="#FB923C"
                        strokeWidth={2}
                        strokeDasharray="8 5"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}

                    {/* Product Bounding Boxes */}
                    {layers.produk &&
                      (isPlanogramView ? result.rect_boxes : result.boxes).map(([x1, y1, x2, y2], i) => (
                        <rect
                          key={`prod-${i}`}
                          x={x1}
                          y={y1}
                          width={Math.max(1, x2 - x1)}
                          height={Math.max(1, y2 - y1)}
                          fill="none"
                          stroke="#22C55E"
                          strokeWidth={1.6}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}

                    {/* Empty Shelf Gaps (Perspective Polygons on Camera View, Rects on Planogram View) */}
                    {layers.celah &&
                      result.gaps.map((g, i) => {
                        const isHighlighted = selectedRowId === null || selectedRowId === g.row;
                        const opacity = isHighlighted ? 0.34 : 0.12;
                        if (isPlanogramView) {
                          const [gx1, gy1, gx2, gy2] = g.rect_bbox;
                          return (
                            <rect
                              key={`gap-${i}`}
                              x={gx1}
                              y={gy1}
                              width={Math.max(1, gx2 - gx1)}
                              height={Math.max(1, gy2 - gy1)}
                              fill={`rgba(239,68,68,${opacity})`}
                              stroke="#EF4444"
                              strokeWidth={1.8}
                              vectorEffect="non-scaling-stroke"
                            />
                          );
                        }
                        return (
                          <polygon
                            key={`gap-${i}`}
                            points={g.poly.map(([px, py]) => `${px},${py}`).join(' ')}
                            fill={`rgba(239,68,68,${opacity})`}
                            stroke="#EF4444"
                            strokeWidth={1.8}
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}

                    {/* Physical Shelf Row Corridors */}
                    {layers.baris &&
                      annotatedRows.map((row) => {
                        const active = selectedRowId === row.id;
                        const strokeColor = row.needsRestock ? '#F87171' : '#FBBF24';
                        if (isPlanogramView) {
                          const [rx1, ry1, rx2, ry2] = row.rect_bbox;
                          return (
                            <g key={`row-${row.id}`}>
                              <rect
                                x={rx1}
                                y={ry1}
                                width={Math.max(1, rx2 - rx1)}
                                height={Math.max(1, ry2 - ry1)}
                                fill={active ? 'rgba(251,191,36,0.14)' : 'none'}
                                stroke={strokeColor}
                                strokeWidth={active ? 2.8 : 1.8}
                                strokeDasharray={active ? undefined : '6 4'}
                                vectorEffect="non-scaling-stroke"
                              />
                              <text
                                x={rx1 + 8}
                                y={ry1 + Math.max(18, svgHeight / 36)}
                                fill="#FEF08A"
                                fontSize={Math.max(13, svgHeight / 38)}
                                fontFamily="monospace"
                                fontWeight="700"
                              >
                                B{row.id} ({row.fill_percent}%)
                              </text>
                            </g>
                          );
                        }
                        const [tl] = row.poly;
                        return (
                          <g key={`row-${row.id}`}>
                            <polygon
                              points={row.poly.map(([px, py]) => `${px},${py}`).join(' ')}
                              fill={active ? 'rgba(251,191,36,0.16)' : 'none'}
                              stroke={strokeColor}
                              strokeWidth={active ? 2.8 : 1.8}
                              strokeDasharray={active ? undefined : '6 4'}
                              vectorEffect="non-scaling-stroke"
                            />
                            {tl && (
                              <text
                                x={tl[0] + 8}
                                y={tl[1] + Math.max(18, svgHeight / 36)}
                                fill="#FEF08A"
                                fontSize={Math.max(13, svgHeight / 38)}
                                fontFamily="monospace"
                                fontWeight="700"
                              >
                                B{row.id}
                              </text>
                            )}
                          </g>
                        );
                      })}

                    {/* Draggable 4-Corner Calibration Handles */}
                    {calibrating &&
                      !isPlanogramView &&
                      draftQuad &&
                      draftQuad.map(([qx, qy], idx) => {
                        const hitRadius = Math.max(24, svgWidth / 28);
                        const visRadius = Math.max(9, svgWidth / 90);
                        return (
                          <g
                            key={`handle-${idx}`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
                              setDraggingCorner(idx);
                              setActiveCornerIdx(idx);
                            }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <circle cx={qx} cy={qy} r={hitRadius} fill="transparent" />
                            <circle
                              cx={qx}
                              cy={qy}
                              r={visRadius}
                              fill={activeCornerIdx === idx ? '#F97316' : '#F5F1EA'}
                              stroke="#141210"
                              strokeWidth={2.5}
                              vectorEffect="non-scaling-stroke"
                            />
                            <text
                              x={qx + visRadius + 5}
                              y={qy + 5}
                              fill="#FFFFFF"
                              fontSize={Math.max(13, svgWidth / 55)}
                              fontFamily="monospace"
                              fontWeight="700"
                            >
                              {CORNER_SHORT[idx]}
                            </text>
                          </g>
                        );
                      })}
                  </svg>
                )}
              </div>
            ) : (
              /* Explicit Actionable Empty State (R-27) */
              <div className="max-w-md text-center px-4 py-12 space-y-4">
                <p className="font-tabular text-xs font-semibold text-[#FB923C]">
                  BELUM ADA CITRA AKTIF
                </p>
                <h2 className="text-lg font-bold text-[#F5F1EA]">
                  Pilih Kamera Toko atau Unggah Foto Rak
                </h2>
                <p className="text-xs sm:text-sm leading-relaxed text-[#C2B9AE]">
                  Klik salah satu tangkapan kamera minimarket di bar atas (misalnya CAM-01 untuk sudut tinggi CCTV atau CAM-03 untuk rak gelap) untuk langsung melihat pemetaan baris dan celah kosong.
                </p>
                {presets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(presets[0])}
                    className="min-h-[44px] px-5 py-2.5 rounded-[6px] bg-[#F97316] hover:bg-[#FB923C] text-[#141210] text-xs font-extrabold cursor-pointer transition-colors"
                  >
                    Muat &amp; Analisis {presets[0].code} Sekarang
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Layer Visibility Controls + Active Camera Note */}
          <div className="p-3 sm:p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['produk', 'Kotak Produk'],
                  ['celah', 'Area Kosong'],
                  ['baris', 'Koridor Baris'],
                  ['poligonRak', 'Batas 4 Sudut'],
                ] as [keyof typeof layers, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={layers[key]}
                  onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className={`min-h-[44px] px-3 rounded-[6px] text-xs font-semibold border transition-colors cursor-pointer ${
                    layers[key]
                      ? 'border-[var(--fg-primary)] bg-[var(--fg-primary)] text-[var(--bg-surface)]'
                      : 'border-[var(--border-strong)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activePreset && (
              <p className="text-xs text-[var(--fg-secondary)] max-w-md">
                <strong className="text-[var(--fg-primary)]">{activePreset.code}:</strong> {activePreset.angle_note}
              </p>
            )}
          </div>
        </section>

        {/* RIGHT / BOTTOM ZONE (5 cols on Desktop, 2-col split on Tablet): RESTOCK DECISIONS & PIPELINE DIAGNOSTICS */}
        <div className="xl:col-span-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 items-start">
          {/* PANEL 1: KEPUTUSAN RESTOCK PER BARIS (Primary Operational Decision) */}
          <section
            aria-label="Keputusan restock per baris rak"
            className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[var(--fg-primary)]">
                  Status Keterisian &amp; Restock Baris
                </h2>
                <p className="text-xs text-[var(--fg-secondary)] mt-0.5">
                  Klik salah satu baris untuk menyorot posisinya pada gambar.
                </p>
              </div>
              {result && (
                <div className="text-right shrink-0">
                  <span className="block font-tabular text-2xl font-bold text-[var(--fg-primary)]">
                    {result.total_fill}%
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                    {result.total_products} produk · {result.total_gap_slots} slot kosong
                  </span>
                </div>
              )}
            </div>

            {/* Restock Threshold Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="restock-slider" className="font-bold text-[var(--fg-primary)]">
                  Ambang Peringatan Restock
                </label>
                <span className="font-tabular font-bold px-2 py-0.5 rounded-[2px] bg-[var(--bg-muted)] text-[var(--fg-primary)]">
                  &lt; {restockThreshold}%
                </span>
              </div>
              <input
                id="restock-slider"
                type="range"
                min={25}
                max={85}
                value={restockThreshold}
                onChange={(e) => setRestockThreshold(Number(e.target.value))}
                className="w-full h-6 accent-[var(--accent)] cursor-pointer"
              />
              <div className="flex justify-between font-tabular text-[11px] text-[var(--fg-secondary)]">
                <span>25% (Longgar)</span>
                <span>65% (Standar Toko)</span>
                <span>85% (Ketat)</span>
              </div>
            </div>

            {result ? (
              <div className="space-y-3">
                <div
                  className={`px-3.5 py-2.5 rounded-[6px] border text-xs font-bold flex items-center justify-between ${
                    restockCount > 0
                      ? 'border-[var(--status-alert)] bg-[var(--status-alert-bg)] text-[var(--status-alert)]'
                      : 'border-[var(--status-ok)] bg-[var(--status-ok-bg)] text-[var(--status-ok)]'
                  }`}
                >
                  <span>
                    {restockCount > 0
                      ? `${restockCount} dari ${annotatedRows.length} baris memerlukan pengisian ulang`
                      : `Seluruh ${annotatedRows.length} baris berada di atas ambang stok`}
                  </span>
                  <span className="font-tabular">{restockThreshold}%</span>
                </div>

                <div className="space-y-2">
                  {annotatedRows.map((row) => {
                    const isSelected = selectedRowId === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedRowId((prev) => (prev === row.id ? null : row.id))}
                        aria-pressed={isSelected}
                        className={`w-full min-h-[56px] p-3 rounded-[8px] border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--bg-muted)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-muted)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-tabular text-xs font-bold px-2 py-0.5 rounded-[2px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-primary)]">
                              B{row.id}
                            </span>
                            <span className="text-xs font-bold text-[var(--fg-primary)]">
                              {row.products} produk
                            </span>
                            <span className="text-xs text-[var(--fg-secondary)]">
                              · {row.gap} slot kosong
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 font-tabular text-xs font-bold px-2 py-0.5 rounded-[2px] ${
                              row.needsRestock
                                ? 'bg-[var(--status-alert-bg)] text-[var(--status-alert)]'
                                : 'bg-[var(--status-ok-bg)] text-[var(--status-ok)]'
                            }`}
                          >
                            {row.needsRestock ? (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            <span>{row.fill_percent}%</span>
                            <span className="sr-only">
                              {row.needsRestock ? 'Perlu Restock' : 'Stok Aman'}
                            </span>
                          </span>
                        </div>

                        <div className="w-full h-2 rounded-[2px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
                          <div
                            className={`h-full ${
                              row.needsRestock ? 'bg-[var(--status-alert)]' : 'bg-[var(--status-ok)]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, row.fill_percent))}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-[var(--fg-secondary)] py-4">
                Daftar baris rak beserta estimasi slot kosong akan muncul di sini setelah citra dianalisis.
              </p>
            )}
          </section>

          {/* PANEL 2: KONTROL PEMROSESAN CITRA & BUKTI HISTOGRAM ROI */}
          <section
            aria-label="Pengaturan pemrosesan citra dan diagnostik pipeline"
            className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
          >
            <div className="pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm sm:text-base font-extrabold text-[var(--fg-primary)]">
                Pipeline Citra &amp; Geometri
              </h2>
              <p className="text-xs text-[var(--fg-secondary)] mt-0.5">
                Ubah modul prapemrosesan lalu jalankan ulang untuk menguji dampaknya pada akurasi baris.
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Coordinate-Space Homography Toggle */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                <div>
                  <p className="text-xs font-bold text-[var(--fg-primary)]">
                    Coordinate-Space Homography &amp; ROI
                  </p>
                  <p className="text-[11px] text-[var(--fg-secondary)]">
                    Isolasi 4 sudut rak &amp; normalisasi perspektif celah
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={useRectify}
                  onClick={() => setUseRectify((prev) => !prev)}
                  className={`min-h-[44px] min-w-[78px] px-3 rounded-[6px] text-xs font-bold border cursor-pointer ${
                    useRectify
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-secondary)]'
                  }`}
                >
                  {useRectify ? 'Aktif' : 'Mati'}
                </button>
              </div>

              {/* Bilateral Denoise Toggle */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                <div>
                  <p className="text-xs font-bold text-[var(--fg-primary)]">Bilateral Filter</p>
                  <p className="text-[11px] text-[var(--fg-secondary)]">
                    Reduksi derau sensor tanpa mengaburkan batas kemasan
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={useDenoise}
                  onClick={() => setUseDenoise((prev) => !prev)}
                  className={`min-h-[44px] min-w-[78px] px-3 rounded-[6px] text-xs font-bold border cursor-pointer ${
                    useDenoise
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-secondary)]'
                  }`}
                >
                  {useDenoise ? 'Aktif' : 'Mati'}
                </button>
              </div>

              {/* ROI Shadow-Aware LAB-CLAHE Mode */}
              <div className="p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-canvas)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--fg-primary)]">
                    LAB L-Channel CLAHE (Area Rak)
                  </span>
                  <span className="font-tabular text-[11px] text-[var(--fg-secondary)]">
                    {claheMode === 'auto' ? 'P25 < 58 / Mean < 95' : claheMode === 'on' ? 'Paksa Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['auto', 'Otomatis'],
                      ['on', 'Selalu'],
                      ['off', 'Mati'],
                    ] as [ClaheMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={claheMode === mode}
                      onClick={() => setClaheMode(mode)}
                      className={`min-h-[44px] px-2 rounded-[6px] text-xs font-bold border cursor-pointer ${
                        claheMode === mode
                          ? 'border-[var(--fg-primary)] bg-[var(--fg-primary)] text-[var(--bg-surface)]'
                          : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Threshold Slider */}
              <div className="p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-canvas)] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="conf-slider" className="font-bold text-[var(--fg-primary)]">
                    Ambang Kepercayaan YOLO11s
                  </label>
                  <span className="font-tabular font-bold text-[var(--fg-primary)]">
                    {confThreshold.toFixed(2)}
                  </span>
                </div>
                <input
                  id="conf-slider"
                  type="range"
                  min={0.15}
                  max={0.5}
                  step={0.05}
                  value={confThreshold}
                  onChange={(e) => setConfThreshold(Number(e.target.value))}
                  className="w-full h-6 accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={loading || (!activePresetId && !uploadedFile)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-45 disabled:cursor-not-allowed text-[var(--accent-fg)] text-xs font-extrabold transition-colors cursor-pointer"
              >
                {loading ? 'Memproses Citra...' : 'Jalankan Ulang Analisis'}
              </button>
            </div>

            {/* Real Computed Diagnostics & Question-Titled ROI Histogram */}
            {pre && (
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                <dl className="grid grid-cols-2 gap-2 font-tabular text-[11px]">
                  <div className="p-2.5 rounded-[6px] bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                    <dt className="text-[var(--fg-secondary)]">Kemiringan &amp; Sumber ROI</dt>
                    <dd className="font-bold text-[var(--fg-primary)] mt-0.5">
                      {pre.rectify_angle_deg}° · {pre.quad_source}
                    </dd>
                  </div>
                  <div className="p-2.5 rounded-[6px] bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                    <dt className="text-[var(--fg-secondary)]">Waktu Proses</dt>
                    <dd className="font-bold text-[var(--fg-primary)] mt-0.5">
                      PC {pre.preprocess_ms} ms · AI {pre.inference_ms} ms
                    </dd>
                  </div>
                </dl>

                {/* Question-titled Histogram (antislop-ui: Charts Without a Question) */}
                <div className="p-3 rounded-[6px] bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-bold text-[var(--fg-primary)]">
                      Apakah bayangan gelap di dalam rak terangkat?
                    </h3>
                    <span className="font-tabular text-[11px] font-semibold text-[var(--accent-text)]">
                      {pre.clahe_applied ? 'CLAHE Aktif' : 'Cahaya Cukup'}
                    </span>
                  </div>
                  <p className="font-tabular text-[11px] text-[var(--fg-secondary)]">
                    Mean ROI: {pre.mean_before} -&gt; {pre.mean_after} (P25 awal: {pre.p25_before})
                  </p>
                  <div
                    role="img"
                    aria-label={`Histogram intensitas area rak dari gelap ke terang, rata-rata sebelum ${pre.mean_before} dan sesudah ${pre.mean_after}`}
                    className="h-16 flex items-end gap-[2px] pt-2"
                  >
                    {pre.hist_after.map((valAfter, idx) => {
                      const valBefore = pre.hist_before[idx] ?? 0;
                      return (
                        <div key={idx} className="flex-1 h-full relative flex items-end">
                          <div
                            className="w-full bg-[var(--border-strong)] opacity-35 rounded-t-[1px]"
                            style={{ height: `${Math.max(4, valBefore)}%` }}
                          />
                          <div
                            className="w-full absolute bottom-0 left-0 bg-[var(--accent-text)] opacity-85 rounded-t-[1px]"
                            style={{ height: `${Math.max(4, valAfter)}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between font-tabular text-[10px] text-[var(--fg-secondary)]">
                    <span>0 (Bayangan Gelap)</span>
                    <span>Intensitas Piksel ROI</span>
                    <span>255 (Terang)</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
