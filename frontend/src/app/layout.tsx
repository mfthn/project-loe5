import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";

export const metadata = {
  title: "Lukla Operations Engine — Platform Operasional Pabrik Garmen",
  description:
    "Platform operasional terpadu pabrik garmen maklon Lukla Manufacturing Ciwidey: Gudang Multi-Klien, Sample Stopwatch, Terminal Produksi 30m, QC Defect Tracking, Payroll Engine, dan AI Dual-Assistant.",
  keywords: "maklon garmen, pabrik garmen, CMT, Semi-CMT, Full Package, Ciwidey, Lukla Manufacturing, Snøhund",
  openGraph: {
    title: "Lukla Operations Engine",
    description: "Pabrik garmen terkendali. Transparan dari Cutting hingga Jahit.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/icon.jpeg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/icon.jpeg" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
