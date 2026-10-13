"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { backWith, str } from "@/lib/action";

// Memproses login. Pesan error dibuat umum agar tidak membocorkan apakah email terdaftar.
export async function loginAction(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");

  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await verifyPassword(password, user.passwordHash));
  if (!user || !ok) backWith("/login", "error", "Email atau password salah.");

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
