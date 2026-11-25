export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--fg-primary)] flex items-center justify-center p-6">
      <div role="status" aria-live="polite" className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-5 text-sm font-semibold">
        Memuat ruang kerja inspeksi rak...
      </div>
    </div>
  );
}
