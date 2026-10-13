import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { canAccessModule, type Module } from "./rbac";

const COOKIE_NAME = "loe_session";
const SESSION_SECONDS = 60 * 60 * 8; // 8 jam

// Secret untuk menandatangani JWT. Wajib diganti di produksi lewat AUTH_SECRET.
function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-secret");
}

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  clientId: string | null;
};

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Membuat session berupa JWT yang disimpan di cookie httpOnly.
export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}

// Mengambil user yang sedang login. Mengembalikan null jika belum login atau token tidak valid.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return await db.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, name: true, role: true, clientId: true },
    });
  } catch {
    return null;
  }
}

// Dipanggil di awal setiap halaman atau aksi yang butuh login dan hak akses modul tertentu.
export async function requireUser(module?: Module): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (module && !canAccessModule(user.role, module)) {
    redirect(`/dashboard?error=${encodeURIComponent("Anda tidak memiliki akses ke modul ini.")}`);
  }
  return user;
}
