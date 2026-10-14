"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, setStoredToken } from "./api";
import type { User, UserRole } from "../types/api";

export interface DemoAccount {
  username: string;
  name: string;
  role: UserRole;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: "owner",
    name: "Pak Hendra (Owner/CEO)",
    role: "OWNER",
    description: "Akses penuh seluruh modul eksekutif, payroll, dan AI Business Tracker.",
  },
  {
    username: "mandor_agus",
    name: "Agus (Mandor Line 1)",
    role: "MANDOR",
    description: "Verifikasi output penjahit per interval 30 menit & penerima pool bonus QC.",
  },
  {
    username: "penjahit_siti",
    name: "Siti (Penjahit Line 1)",
    role: "PENJAHIT",
    description: "Input cepat terminal touchscreen output 30 menit & hitung borongan.",
  },
  {
    username: "gudang_budi",
    name: "Budi (Petugas Gudang)",
    role: "GUDANG",
    description: "Penerimaan & pengeluaran bahan dengan proteksi anti-kontaminasi.",
  },
  {
    username: "adis_sample",
    name: "Adis (Tim Sample)",
    role: "TIM_SAMPLE",
    description: "Katalog sampel, versi approval, dan stopwatch digital time study.",
  },
  {
    username: "qc_dewi",
    name: "Dewi (QC Inspector)",
    role: "QC_INSPECTOR",
    description: "Inspeksi LOLOS / REPAIR / DEFECT & akumulasi pool bonus.",
  },
  {
    username: "finance_rina",
    name: "Rina (Finance & Payroll)",
    role: "FINANCE_PAYROLL",
    description: "Preview kalkulasi payroll Sabtu & kunci transaksi permanen (Audit Lock).",
  },
  {
    username: "klien_a",
    name: "Ibu Maya (Klien Maklon A)",
    role: "KLIEN_MAKLON",
    description: "Portal B2B terisolasi: pantau stok bahan & progress produksi pesanan.",
  },
];

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password?: string) => Promise<User>;
  quickLogin: (username: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Password default untuk akun demo sesuai scripts/seed.py
const DEMO_PASSWORDS: Record<string, string> = {
  owner: "owner123",
  adis_sample: "sample123",
  gudang_budi: "gudang123",
  mandor_agus: "mandor123",
  mandor_joko: "mandor123",
  ka_ops: "kaops123",
  penjahit_siti: "jahit123",
  penjahit_rini: "jahit123",
  qc_dewi: "qc123",
  finance_rina: "finance123",
  klien_a: "klien123",
  klien_b: "klien123",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (username: string, password?: string): Promise<User> => {
    const pwd = password || DEMO_PASSWORDS[username] || "password123";
    const res = await authApi.login(username, pwd);
    setUser(res.user);
    return res.user;
  };

  const quickLogin = async (username: string): Promise<User> => {
    return login(username, DEMO_PASSWORDS[username]);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Abaikan jika server error
    } finally {
      setUser(null);
      setStoredToken(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        quickLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
