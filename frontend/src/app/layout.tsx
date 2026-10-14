import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "project-loe5",
  description: "Platform operasional pabrik garmen",
};

// Layout root: hanya menyiapkan HTML, bahasa Indonesia, dan viewport responsif.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
