import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";

export const metadata = {
  title: "Lukla Operations Engine (project-loe5)",
  description:
    "Platform Operasional Terpadu Konveksi Garmen Ciwidey: Gudang Multi-Klien, Sample Stopwatch, Terminal 30m, QC Defect, Payroll Engine Sabtu, dan AI Dual-Assistant.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
