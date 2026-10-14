# Frontend project-loe5 (Next.js)

Lihat README utama di folder root untuk langkah setup lengkap.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # pemeriksaan tipe TypeScript
npm run build      # build produksi
```

## Catatan keamanan dependensi

- `next` dipin ke 15.5.27. Versi 15.3.1 memiliki kerentanan kritis dan tidak boleh dipakai.
- `package.json` memuat `overrides` untuk `postcss` 8.5.23 karena versi bawaan Next memiliki kerentanan. Override dihapus saat pindah ke Next 16.
- Audit: `npm audit --omit=dev` harus menampilkan 0 vulnerabilities sebelum rilis.
