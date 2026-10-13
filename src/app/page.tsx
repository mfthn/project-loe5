import { redirect } from "next/navigation";

// Halaman utama langsung diarahkan ke dashboard. Jika belum login, dashboard akan mengarahkan ke /login.
export default function Home() {
  redirect("/dashboard");
}
