"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { authApi } from "../../lib/api";
import type { User, UserRole } from "../../types/api";

const ROLES: UserRole[] = [
  "OWNER",
  "TIM_SAMPLE",
  "GUDANG",
  "MANDOR",
  "PENJAHIT",
  "QC_INSPECTOR",
  "FINANCE_PAYROLL",
  "KLIEN_MAKLON",
];

export default function PenggunaPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("PENJAHIT");
  const [isActive, setIsActive] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      setUsers(await authApi.getUsers());
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat akun." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditId(null);
    setUsername("");
    setPassword("");
    setName("");
    setEmail("");
    setRole("PENJAHIT");
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditId(u.id);
    setUsername(u.username);
    setPassword("");
    setName(u.name);
    setEmail(u.email || "");
    setRole(u.role);
    setIsActive(u.is_active);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await authApi.updateUser(editId, {
          name,
          email: email || undefined,
          role,
          is_active: isActive,
        });
        setNotice({ type: "success", message: "Akun diperbarui." });
      } else {
        await authApi.createUser({ username, password, name, email: email || undefined, role });
        setNotice({ type: "success", message: `Akun ${username} dibuat.` });
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menyimpan akun." });
    }
  };

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Hapus akun ${u.username}? Akun berriwayat hanya bisa dinonaktifkan.`)) return;
    try {
      await authApi.deleteUser(u.id);
      setNotice({ type: "success", message: `Akun ${u.username} dihapus.` });
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menghapus akun." });
    }
  };

  return (
    <AppLayout
      title="Kelola Akun Pekerja"
      subtitle="Buat, edit otorisasi peran, nonaktifkan, dan hapus akun (khusus Owner)"
      requiredModule="pengguna"
    >
      {notice && <Notice type={notice.type} message={notice.message} onClose={() => setNotice(null)} />}

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={openCreate} className="btn btn-primary">
          ➕ Buat Akun Pekerja
        </button>
        <button onClick={loadData} className="btn btn-ghost btn-sm">
          🔄 Muat Ulang
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Nama</th>
              <th>Peran / Otorisasi</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                  {loading ? "Memuat akun..." : "Belum ada akun."}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} style={!u.is_active ? { opacity: 0.55 } : undefined}>
                  <td className="font-mono" style={{ fontWeight: 700 }}>{u.username}</td>
                  <td>{u.name}</td>
                  <td><span className="badge badge-purple">{u.role}</span></td>
                  <td>
                    <span className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}>
                      {u.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(u)} className="btn btn-secondary btn-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => authApi.updateUser(u.id, { is_active: !u.is_active }).then(loadData).catch((err: any) => setNotice({ type: "danger", message: err.message }))}
                        className="btn btn-ghost btn-sm"
                      >
                        {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button onClick={() => handleDelete(u)} className="btn btn-secondary btn-sm">
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "✏️ Edit Akun Pekerja" : "➕ Buat Akun Pekerja"}>
        <form onSubmit={handleSubmit}>
          {!editId && (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input type="text" className="form-input font-mono" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password awal (min 6)</label>
                <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Nama Lengkap</label>
            <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email (opsional)</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Peran / Otorisasi</label>
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value as UserRole)} required>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {editId && (
            <div className="form-group">
              <label className="form-label">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Akun aktif
              </label>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
