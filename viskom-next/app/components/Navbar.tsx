'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  variant?: 'landing' | 'dashboard';
}

export default function Navbar({ variant = 'landing' }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 min-h-[44px] pr-2 text-[var(--fg-primary)] font-extrabold text-lg tracking-tight"
          >
            <span className="inline-block w-2.5 h-5 rounded-[2px] bg-[var(--accent)]" aria-hidden="true" />
            <span>Rakku</span>
          </Link>
          <span className="hidden sm:inline-block font-tabular text-[11px] font-medium px-2 py-0.5 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--fg-secondary)]">
            {variant === 'dashboard' ? 'INSPEKSI KAMERA TOKO' : 'VISI KOMPUTER RITEL'}
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav aria-label="Navigasi utama" className="hidden md:flex items-center gap-6">
          {variant === 'landing' ? (
            <>
              <a
                href="#arsitektur"
                className="min-h-[44px] inline-flex items-center text-sm font-semibold text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
              >
                Alur Geometri
              </a>
              <a
                href="#evaluasi"
                className="min-h-[44px] inline-flex items-center text-sm font-semibold text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
              >
                Skenario Toko
              </a>
              <ThemeToggle />
              <Link
                href="/dashboard"
                className="min-h-[44px] inline-flex items-center justify-center px-4 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-sm font-bold transition-colors"
              >
                Buka Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/"
                className="min-h-[44px] inline-flex items-center text-sm font-semibold text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
              >
                Halaman Utama
              </Link>
              <ThemeToggle />
            </>
          )}
        </nav>

        {/* Mobile Actions: Primary destination remains visible + labeled Menu button */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          {variant === 'landing' ? (
            <>
              <Link
                href="/dashboard"
                className="min-h-[44px] inline-flex items-center justify-center px-3 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-bold transition-colors"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav-panel"
                className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-primary)] text-xs font-semibold"
              >
                <span>{menuOpen ? 'Tutup' : 'Menu'}</span>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  {menuOpen ? (
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            </>
          ) : (
            <Link
              href="/"
              className="min-h-[44px] px-3 inline-flex items-center rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--fg-primary)] text-xs font-semibold"
            >
              Beranda
            </Link>
          )}
        </div>
      </div>

      {variant === 'landing' && menuOpen && (
        <nav
          id="mobile-nav-panel"
          aria-label="Menu bagian halaman"
          className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 flex flex-col gap-1"
        >
          <a
            href="#arsitektur"
            onClick={() => setMenuOpen(false)}
            className="min-h-[44px] px-3 inline-flex items-center rounded-[6px] text-sm font-semibold text-[var(--fg-primary)] hover:bg-[var(--bg-muted)]"
          >
            Alur Geometri & Homografi
          </a>
          <a
            href="#evaluasi"
            onClick={() => setMenuOpen(false)}
            className="min-h-[44px] px-3 inline-flex items-center rounded-[6px] text-sm font-semibold text-[var(--fg-primary)] hover:bg-[var(--bg-muted)]"
          >
            Skenario Kamera Toko
          </a>
        </nav>
      )}
    </header>
  );
}
