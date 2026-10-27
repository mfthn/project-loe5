"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { authApi, lockFormSubmit, unlockFormSubmit } from "../../lib/api";
import { formatClientCode, normalizePhone } from "../../lib/config";
import type { ClientCodeChange, ClientProfile, User, UserRole } from "../../types/api";

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

type ClientDraft = {
  company_name: string;
  contact_person: string;
  phone_number: string;
};

export default function PenggunaPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // ── Form akun pekerja ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("PENJAHIT");
  const [isActive, setIsActive] = useState(true);

  // ── Form klien maklon ──
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [clientCompany, setClientCompany] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [pendingChange, setPendingChange] = useState<{
    draft: ClientDraft;
    newCode: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  // ── Riwayat perubahan ID ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyClient, setHistoryClient] = useState<ClientProfile | null>(null);
  const [historyRows, setHistoryRows] = useState<ClientCodeChange[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nextUsers, nextClients] = await Promise.all([
        authApi.getUsers(),
        authApi.getClients(),
      ]);
      setUsers(nextUsers);
      setClients(nextClients);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat data." });
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
    if (!lockFormSubmit(e)) return; // cegah spam klik ganda
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
      unlockFormSubmit(e); // gagal → izinkan coba lagi
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

  // ── Klien maklon ──
  const openEditClient = (c: ClientProfile) => {
    setEditClientId(c.id);
    setClientCompany(c.company_name);
    setClientContact(c.contact_person || "");
    setClientPhone(c.phone_number || "");
    setOriginalPhone(c.phone_number || "");
    setOriginalCode(c.client_code);
    setClientModalOpen(true);
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizePhone(clientPhone);
    if (normalizedPhone.length < 8) {
      setNotice({
        type: "danger",
        message: "Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx atau +62xxxxxxxxxx.",
      });
      return;
    }

    const draft: ClientDraft = {
      company_name: clientCompany.trim(),
      contact_person: clientContact.trim(),
      phone_number: normalizedPhone,
    };

    // Nomor berubah → minta konfirmasi eksplisit karena ID Klien ikut berubah.
    if (normalizedPhone !== originalPhone) {
      setPendingChange({ draft, newCode: formatClientCode(normalizedPhone) });
      setConfirmOpen(true);
      return;
    }

    submitClientUpdate(draft);
  };

  const submitClientUpdate = async (draft: ClientDraft) => {
    if (!editClientId) return;
    try {
      setSavingClient(true);
      const res = await authApi.updateClient(editClientId, draft);
      setNotice({
        type: "success",
        message: res.client_code_changed
          ? `Data klien tersimpan. ID Klien berubah: ${res.previous_client_code} → ${res.client_code}.`
          : "Data klien diperbarui.",
      });
      setClientModalOpen(false);
      setConfirmOpen(false);
      setPendingChange(null);
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menyimpan data klien." });
    } finally {
      setSavingClient(false);
    }
  };

  const confirmPhoneChange = () => {
    if (pendingChange) submitClientUpdate(pendingChange.draft);
  };

  const openHistory = async (c: ClientProfile) => {
    setHistoryClient(c);
    setHistoryOpen(true);
    try {
      setHistoryLoading(true);
      setHistoryRows(await authApi.getClientCodeHistory(c.id));
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat riwayat ID klien." });
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <AppLayout
      title="Kelola Pengguna & Klien"
      subtitle="Buat akun pekerja, atur otorisasi peran, dan kelola data klien maklon (khusus Owner)"
      requiredModule="pengguna"
    >
      {notice && <Notice type={notice.type} message={notice.message} onClose={() => setNotice(null)} />}

      {/* ═══ Akun Pekerja ═══ */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#2E1065", margin: 0 }}>Akun Pekerja</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
              Akses internal pabrik sesuai matriks RBAC.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={openCreate} className="btn btn-primary">
              ➕ Buat Akun Pekerja
            </button>
            <button onClick={loadData} className="btn btn-ghost btn-sm">
              🔄 Muat Ulang
            </button>
          </div>
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
      </section>

      {/* ═══ Klien Maklon ═══ */}
      <section>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#2E1065", margin: 0 }}>Klien Maklon</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
            ID Klien mengikuti nomor HP dengan prefix <strong className="font-mono">LOE5-</strong>. Mengubah nomor HP akan mengubah ID Klien.
          </p>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID Klien</th>
                <th>Perusahaan / Brand</th>
                <th>PIC</th>
                <th>No. HP</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    {loading ? "Memuat klien..." : "Belum ada klien."}
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono" style={{ fontWeight: 700, color: "#7C3AED" }}>{c.client_code}</td>
                    <td>{c.company_name}</td>
                    <td>{c.contact_person || "-"}</td>
                    <td className="font-mono">{c.phone_number || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => openEditClient(c)} className="btn btn-secondary btn-sm">
                          Edit
                        </button>
                        <button onClick={() => openHistory(c)} className="btn btn-ghost btn-sm">
                          Riwayat ID
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ Modal akun pekerja ═══ */}
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

      {/* ═══ Modal edit klien ═══ */}
      <Modal isOpen={clientModalOpen} onClose={() => setClientModalOpen(false)} title="✏️ Edit Data Klien">
        <form onSubmit={handleClientSubmit}>
          <div className="form-group">
            <label className="form-label">ID Klien Saat Ini</label>
            <input type="text" className="form-input font-mono" value={originalCode} readOnly disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Nama Perusahaan / Brand</label>
            <input type="text" className="form-input" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} minLength={2} required />
          </div>
          <div className="form-group">
            <label className="form-label">Nama PIC / Kontak</label>
            <input type="text" className="form-input" value={clientContact} onChange={(e) => setClientContact(e.target.value)} minLength={2} required />
          </div>
          <div className="form-group">
            <label className="form-label">No. WhatsApp / Telepon</label>
            <input type="tel" inputMode="tel" className="form-input font-mono" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} minLength={8} required />
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
              ID Klien akan menjadi <strong className="font-mono">LOE5-{normalizePhone(clientPhone) || "..."}</strong> jika nomor ini disimpan.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setClientModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={savingClient}>
              {savingClient ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══ Modal konfirmasi perubahan nomor / ID ═══ */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="⚠️ Konfirmasi Perubahan Nomor HP">
        {pendingChange && (
          <>
            <div
              style={{
                background: "var(--warning-soft, #fffbeb)",
                border: "1.5px solid var(--warning-border, #fde68a)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: "0.85rem", color: "#92400e", fontWeight: 700, margin: "0 0 10px" }}>
                Nomor HP berubah, sehingga ID Klien ikut berubah:
              </p>
              <div className="font-mono" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "0.95rem" }}>
                <span style={{ textDecoration: "line-through", color: "#92400e" }}>{originalCode}</span>
                <span style={{ color: "#92400e" }}>→</span>
                <strong style={{ color: "#065f46" }}>{pendingChange.newCode}</strong>
              </div>
            </div>
            <ul style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7, paddingLeft: 20, margin: "0 0 16px" }}>
              <li>ID lama tidak berlaku lagi pada dokumen, cetakan, dan percakapan WhatsApp.</li>
              <li>Riwayat pesanan, stok, sample, dan invoice tetap aman karena tersimpan berdasarkan <span className="font-mono">client_id</span>.</li>
              <li>Perubahan ini dicatat di log audit dan dapat dilihat lewat tombol <strong>Riwayat ID</strong>.</li>
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)} disabled={savingClient}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmPhoneChange} disabled={savingClient}>
                {savingClient ? "Menyimpan..." : "Ya, ubah nomor & ID"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ═══ Modal riwayat ID ═══ */}
      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title={`🕘 Riwayat ID — ${historyClient?.company_name || ""}`}>
        {historyLoading ? (
          <p style={{ color: "var(--text-muted)" }}>Memuat riwayat...</p>
        ) : historyRows.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Belum ada perubahan ID Klien.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>ID Lama</th>
                  <th>ID Baru</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontSize: "0.8rem" }}>
                      {new Date(row.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="font-mono" style={{ color: "#92400e" }}>{row.old_client_code}</td>
                    <td className="font-mono" style={{ color: "#059669", fontWeight: 700 }}>{row.new_client_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
