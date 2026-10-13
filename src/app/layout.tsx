import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "project-loe5 | Operasional Garmen",
  description: "Platform operasional pabrik garmen Ciwidey",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

// Layout root. Hanya menyiapkan HTML, CSS, dan bahasa Indonesia.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
