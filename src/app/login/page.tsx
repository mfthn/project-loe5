import { Notice } from "@/components/Notice";
import { loginAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <h1>Masuk</h1>
        <p className="muted" style={{ marginBottom: 16 }}>project-loe5 · Operasional Garmen</p>
        <Notice error={sp.error} />
        <form action={loginAction} style={{ display: "grid", gap: 12 }}>
          <label>
            Email
            <input type="email" name="email" required placeholder="nama@loe.test" />
          </label>
          <label>
            Password
            <input type="password" name="password" required />
          </label>
          <button className="btn" type="submit">Masuk</button>
        </form>
      </div>
    </main>
  );
}
