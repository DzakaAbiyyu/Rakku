import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard Inspeksi Rak | Rakku",
  description:
    "Ruang kerja interaktif pemantauan keterisian rak, kalibrasi 4 sudut perspektif kamera toko, dan analisis kebutuhan restock per baris.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-full flex flex-col bg-[var(--bg-canvas)]">
      <Navbar variant="dashboard" />
      <main className="flex-1">
        <DashboardClient />
      </main>
    </div>
  );
}
