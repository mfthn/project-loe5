/**
 * Konten Landing Page "Lukla Operations Engine" (project-loe5)
 * Dikelola terpisah agar mudah disesuaikan atau diganti oleh tim marketing/klien.
 * Mematuhi prinsip: Tanpa klaim angka tak terkonfirmasi, ramah industri garmen, Bahasa Indonesia hangat & profesional.
 */

export interface HeadlineOption {
  id: string;
  badge: string;
  headline: string;
  subheadline: string;
  rationale: string;
}

export const HERO_HEADLINES: HeadlineOption[] = [
  {
    id: "ops-clarity",
    badge: "Pabrik garmen multi-klien • Real-time 30 menit",
    headline: "Produksi terkendali, dari sample hingga payroll.",
    subheadline:
      "Platform operasional konveksi Ciwidey dengan isolasi stok multi-klien, pencatatan borongan tiap 30 menit, dan transparansi upah mingguan yang akurat.",
    rationale:
      "Fokus pada kejelasan end-to-end manufaktur. Sangat kuat untuk meyakinkan calon klien maklon bahwa setiap tahapan terkontrol tanpa risiko tertukar.",
  },
  {
    id: "speed-trust",
    badge: "Kapasitas ±70 mesin aktif • Multi-klien transparan",
    headline: "Maklon presisi tanpa cemas bahan tertukar.",
    subheadline:
      "Sistem perlindungan anti-kontaminasi silang dan rekam mutu QC digital untuk brand internal Snøhund dan mitra maklon B2B terkemuka.",
    rationale:
      "Menargetkan pain-point nomor satu klien maklon: kekhawatiran kain atau aksesoris premium mereka tertukar dengan order brand lain di lantai potong.",
  },
  {
    id: "scale-modern",
    badge: "Transparansi lantai produksi • Akurasi borongan",
    headline: "Visibilitas lantai jahit dalam genggaman Anda.",
    subheadline:
      "Pantau progres order dari tablet mandor, stopwatch time study per komponen, hingga laporan kesiapan pengiriman barang jadi secara real-time.",
    rationale:
      "Menonjolkan kecanggihan modernisasi pabrik bagi pemilik brand yang membutuhkan kepastian jadwal kirim dan standar kualitas QC yang konsisten.",
  },
];

export const LANDING_CONTENT = {
  brand: {
    name: "Lukla Operations Engine",
    company: "Lukla Manufacturing",
    productOwner: "Lukla Manufacturing Operations Team & Snøhund Brand Management",
    facility: "Ciwidey Production Facility",
    location: "Ciwidey, Kab. Bandung",
    tagline: "Operational Garment Management System for Multi-Client Manufacturing & Dynamic Payroll",
    consultationWhatsapp: "https://wa.me/6281234567890?text=Halo%20Tim%20Pemesanan%20Lukla%20Manufacturing,%20saya%20tertarik%20konsultasi%20skema%20maklon%20garmen.",
    consultationTelegram: "https://t.me/lukla_manufacturing",
  },

  nav: {
    links: [
      { label: "Layanan", href: "#layanan" },
      { label: "Skema Kerja Sama", href: "#skema" },
      { label: "Cara Kerja", href: "#alur" },
      { label: "Fitur", href: "#fitur" },
      { label: "Portal Klien", href: "#portal-klien" },
      { label: "FAQ", href: "#faq" },
    ],
    ctaLogin: "Masuk Portal",
    ctaConsultation: "Konsultasi Asisten",
  },

  bento: {
    sectionBadge: "Keunggulan Sistem",
    sectionTitle: "Disiplin Operasional Terpadu di Lantai Pabrik",
    sectionSubtitle: "Empat pilar utama yang menjaga mutu dan ketepatan ritme kerja konveksi berkapasitas ±70 mesin jahit.",
    cards: [
      {
        id: "isolation",
        type: "dark-purple",
        title: "Pemisahan stok otomatis per klien",
        desc: "Sistem memblokir pengeluaran bahan jika Tag ID klien tidak cocok dengan nomor pesanan di meja potong.",
        meta: "Proteksi Anti-Kontaminasi Silang",
        linkText: "Pelajari sistem gudang",
        linkHref: "#fitur",
      },
      {
        id: "stat-card",
        type: "white-stat",
        metric: "30",
        metricUnit: "Mnt",
        metricNote: "Interval pencatatan output mandor",
        title: "Input Output Real-Time",
        desc: "Pencatatan bertahap tiap 30 menit meniadakan selisih rekap antara penjahit borongan dan mandor meja.",
        linkText: "Lihat alur line",
        linkHref: "#alur",
      },
      {
        id: "time-study",
        type: "visual-cut",
        title: "Output tercatat tiap 30 menit",
        desc: "Input interval mandor langsung dari tablet layar sentuh dengan stopwatch time study standar garmen.",
        meta: "±70 Mesin Jahit Aktif",
        linkText: "Lihat cara kerja",
        linkHref: "#alur",
      },
      {
        id: "payroll",
        type: "pink-soft",
        title: "Payroll borongan otomatis setiap Sabtu",
        desc: "Upah dihitung dari output terverifikasi ditambah uang makan 10–15% dan pool bonus QC dibagi rata 2 Mandor + 1 Kepala Ops.",
        meta: "Audit Lock Permanen (FR-10)",
        linkText: "Pelajari skema payroll",
        linkHref: "#skema",
      },
    ],
  },

  skema: {
    badge: "Fleksibilitas Kemitraan B2B",
    title: "Tiga Skema Kerja Sama Maklon",
    subtitle: "Pilih opsi kemitraan yang paling sesuai dengan kesiapan rantai pasok dan pasokan bahan brand Anda.",
    cards: [
      {
        id: "cmt",
        code: "CMT",
        name: "Cut, Make, & Trim",
        tagline: "Klien menyediakan seluruh bahan baku dan aksesoris.",
        highlight: false,
        badge: null,
        fitFor: "Brand yang sudah memiliki supplier kain & aksesoris mandiri",
        points: [
          "Klien mengirim kain utama, furing, benang khusus, resleting, dan label",
          "Lukla menyediakan jasa potong presisi, jahit lini konveksi, dan QC finishing",
          "Pencatatan sisa kain per rol transparan dan dapat ditarik kembali",
        ],
        prompt: "Bagaimana alur dan syarat pengiriman bahan untuk skema CMT?",
      },
      {
        id: "semi-cmt",
        code: "Semi-CMT",
        name: "CMT dengan Aksesoris Terkelola",
        tagline: "Klien mengirim bahan utama; Lukla melengkapi bahan pendukung.",
        highlight: true,
        badge: "Paling Populer untuk Brand Tumbuh",
        fitFor: "Brand yang ingin fokus pada desain tanpa repot mencari kancing & benang",
        points: [
          "Klien mengirim bahan kain utama dan label brand utama",
          "Lukla menyediakan benang jahit standar, interlining, karet, kancing, dan polybag",
          "Pengecekan kecocokan warna benang (color matching) sebelum produksi massal",
        ],
        prompt: "Aksesoris apa saja yang disediakan Lukla pada skema Semi-CMT?",
      },
      {
        id: "full-package",
        code: "CMT + Bahan",
        name: "Full Package / Produksi Penuh",
        tagline: "Lukla menyediakan seluruh pengadaan bahan baku hingga garmen jadi.",
        highlight: false,
        badge: "Termasuk Order Internal Snøhund",
        fitFor: "Mitra corporate atau brand yang membutuhkan solusi produksi satu pintu",
        points: [
          "Pengadaan kain bersertifikasi dan aksesoris berkualitas dari vendor rekanan terverifikasi",
          "Pengembangan sample awal (v1 hingga approval) ditangani langsung tim riset Lukla",
          "Pengemasan siap kirim (steam iron, hangtag, barcode, dan master box)",
        ],
        prompt: "Apakah bisa membuat sample jaket gunung dengan skema Full Package?",
      },
    ],
  },

  workflow: {
    badge: "Transparansi 6 Fase",
    title: "Alur Produksi Terkendali dari Hulu ke Hilir",
    subtitle: "Setiap batch pesanan melewati enam tahapan ketat dengan verifikasi digital di setiap checkpoint.",
    steps: [
      {
        num: "01",
        title: "Sample & Riset",
        desc: "Pembuatan prototipe awal, pencatatan spek bahan, dan stopwatch time study per komponen jahit.",
      },
      {
        num: "02",
        title: "Approval & Order",
        desc: "Klien menyetujui versi sampel final, mengunci toleransi ukuran, dan konversi ke order massal.",
      },
      {
        num: "03",
        title: "Gudang & Cutting",
        desc: "Bahan masuk diverifikasi dengan Tag ID klien. Sistem memblokir kain jika order tidak sesuai.",
      },
      {
        num: "04",
        title: "Line Produksi",
        desc: "Alokasi penjahit ke lini mesin paralel. Mandor mencatat output borongan tiap interval 30 menit.",
      },
      {
        num: "05",
        title: "QC & Barang Jadi",
        desc: "Inspeksi rekam mutu: Lolos, Repair (maks 3x toleransi), atau Defect. Akumulasi pool bonus mandor.",
      },
      {
        num: "06",
        title: "Payroll & Rekap",
        desc: "Tutup buku Sabtu: kalkulasi otomatis upah borongan, uang makan, dan laporan HPP batch terkunci.",
      },
    ],
  },

  features: [
    {
      id: "kontaminasi",
      reverse: false,
      badge: "Skenario 1 (P0)",
      title: "Proteksi Anti-Kontaminasi Silang Multi-Klien",
      desc: "Gudang konveksi kami melayani beberapa brand secara bersamaan. Sistem kami mencegah kelalaian manusia dengan mewajibkan validasi barcode tag klien sebelum bahan dapat dipindahkan ke meja potong.",
      highlights: [
        "Isolasi rak penyimpanan material berdasarkan Tag Klien resmi",
        "Peringatan sistem seketika jika operator salah mengambil gulungan kain",
        "Riwayat mutasi keluar-masuk material transparan dan dapat diaudit",
      ],
      linkText: "Konsultasikan keamanan bahan Anda",
      linkHref: "#asisten",
    },
    {
      id: "terminal-30m",
      reverse: true,
      badge: "Skenario 2 & 4 (P0)",
      title: "Terminal 30 Menit & Pemantauan Ritme Pabrik",
      desc: "Setiap 30 menit, penjahit dan mandor mendokumentasikan progres output komponen. Data langsung menyegarkan dashboard operasional tanpa perlu menunggu rekap kertas di akhir hari.",
      highlights: [
        "Deteksi dini hambatan jahit (bottle-neck) pada komponen rumit",
        "Stopwatch digital time study untuk mengukur standar detik per komponen",
        "Mandor memvalidasi hasil kerja langsung di lantai produksi",
      ],
      linkText: "Ketahui kapasitas lini jahit kami",
      linkHref: "#skema",
    },
    {
      id: "payroll-audit",
      reverse: false,
      badge: "Skenario 3 (P0)",
      title: "Transparansi Upah Borongan & Kunci Audit Sabtu",
      desc: "Kesejahteraan penjahit dan ketenangan pemilik brand dibangun dari keadilan hitungan. Seluruh upah borongan berasal dari data output yang telah lolos QC, dilengkapi insentif mutu 3-arah.",
      highlights: [
        "Kalkulasi upah otomatis: tarif komponen × qty terverifikasi",
        "Uang makan fleksibel 10–15% dan pool bonus QC dibagi rata 2 Mandor + 1 Kepala Ops",
        "Penguncian transaksi permanen (Audit Lock Sabtu) yang tidak bisa diubah siapa pun",
      ],
      linkText: "Pelajari integritas sistem payroll",
      linkHref: "#asisten",
    },
  ],

  portalKlien: {
    badge: "Akses Eksklusif B2B",
    title: "Portal Klien: Pantau Produksi Tanpa Perlu Tanya Berulang",
    subtitle: "Mitra maklon mendapatkan akun khusus untuk memantau status pesanan dan saldo stok bahan titipan secara mandiri.",
    stages: [
      { name: "Sample Approval", status: "Selesai", date: "v2 Final Disetujui" },
      { name: "Cutting & Gelar", status: "Selesai", date: "Bahan Terverifikasi" },
      { name: "Sewing (Jahit)", status: "Sedang Berjalan", date: "Interval 30m Aktif" },
      { name: "Quality Control", status: "Menunggu", date: "Target 0 Defect" },
      { name: "Packaging & Kirim", status: "Terjadwal", date: "Siap Kirim" },
    ],
    ctaText: "Masuk sebagai Klien Maklon",
    ctaHref: "/login",
  },

  asistenCta: {
    badge: "Didukung Amazon Bedrock RAG",
    title: "Belum Yakin Skema yang Cocok untuk Brand Anda?",
    subtitle: "Tanyakan langsung kepada Asisten Cerdas kami mengenai alur maklon, perbedaan CMT vs Semi-CMT, atau estimasi persiapan sampel.",
    sampleChat: [
      {
        sender: "user",
        text: "Saya punya brand jaket outdoor baru di Bandung. Untuk order perdana 200 pcs, lebih baik pakai skema apa?",
      },
      {
        sender: "ai",
        text: "Untuk pesanan perdana 200 pcs, kami sarankan skema Semi-CMT. Anda cukup mengirimkan kain utama (waterproof/taslan), sementara tim Lukla menyediakan benang nilon kuat, kancing snap, dan resleting standar outdoor.",
      },
    ],
    suggestedChips: [
      "Berapa minimal order (MOQ) untuk jaket gunung?",
      "Bagaimana prosedur pembuatan sample awal?",
      "Apakah bahan sisa produksi bisa kami bawa pulang?",
    ],
    disclaimer:
      "Catatan: Asisten AI memberikan panduan SOP & informasi umum. Harga final, jadwal antrean jahit, dan kuota kapasitas dikonfirmasi langsung oleh Bagian Pemesanan Lukla Manufacturing.",
    ctaPrimary: "Mulai Konsultasi dengan Asisten",
    ctaPrimaryHref: "/ai-assistant",
    ctaSecondary: "Hubungi Bagian Pemesanan (WhatsApp)",
  },

  stats: {
    badge: "Kapasitas & Kapabilitas",
    title: "Skala Produksi yang Terukur",
    subtitle: "Didukung infrastruktur modern di kawasan konveksi Ciwidey Production Facility, melayani brand Snøhund & mitra B2B.",
    items: [
      {
        value: "±70",
        unit: "Mesin",
        label: "Kapasitas Mesin Jahit Aktif",
        desc: "Lini paralel fleksibel tanpa batasan slot kaku (kapasitas cair 1–70+ mesin)",
        verified: true,
      },
      {
        value: "6",
        unit: "Modul",
        label: "Modul Operasional Utama",
        desc: "Sample, Gudang Multi-Klien, Line Produksi, QC, Payroll, & Portal",
        verified: true,
      },
      {
        value: "8",
        unit: "Peran",
        label: "Hak Akses Terisolasi (RBAC)",
        desc: "Owner, Mandor, Penjahit, Gudang, QC, Finance, Sample, & Klien Maklon",
        verified: true,
      },
      {
        value: "30",
        unit: "Menit",
        label: "Interval Input Output",
        desc: "Pencatatan bertahap komponen via terminal touch-friendly mandor lantai pabrik",
        verified: true,
      },
    ],
  },

  faq: {
    badge: "Pertanyaan Umum",
    title: "Hal yang Sering Ditanyakan Calon Klien",
    subtitle: "Jawaban transparan seputar komitmen kualitas dan mekanisme kerja sama di Lukla Manufacturing.",
    items: [
      {
        q: "Apakah bahan kain milik brand kami aman dan tidak akan tertukar?",
        a: "Sangat aman. Setiap rol bahan yang tiba di gudang langsung diberi label Tag ID unik yang mengunci identitas klien dan nomor pesanan. Meja potong kami memiliki pemindai yang akan memblokir proses jika kain yang ditarik tidak sesuai dengan surat jalan pesanan.",
      },
      {
        q: "Apa perbedaan paling mendasar antara CMT dan Semi-CMT?",
        a: "Pada skema CMT murni, Anda menyediakan seluruh bahan dari kain utama hingga kancing, benang, dan label. Pada Semi-CMT, Anda hanya menyediakan kain utama, sedangkan benang jahit berkualitas, kancing standar, dan aksesoris pendukung disediakan oleh Lukla Manufacturing.",
      },
      {
        q: "Bagaimana tahapan dari pembuatan sampel hingga produksi massal?",
        a: "Proses dimulai dari pembuatan Sample v1 bersama tim sampel kami, dilanjutkan dengan stopwatch time study per komponen. Setelah sampel disetujui (Approved), spesifikasi dikunci permanen ke dalam sistem dan dikonversi menjadi Surat Perintah Kerja (SPK) produksi massal.",
      },
      {
        q: "Apakah kami sebagai klien bisa memantau jalannya produksi secara online?",
        a: "Ya. Setiap klien maklon terdaftar memiliki akses ke Portal Klien B2B. Anda dapat melihat tahapan pengerjaan (Sample → Cutting → Sewing → QC → Selesai) dan memantau stok bahan baku titipan Anda di gudang kami secara real-time.",
      },
      {
        q: "Bagaimana cara mendapatkan konfirmasi harga final dan jadwal pengerjaan?",
        a: "Setelah berdiskusi mengenai spesifikasi awal di Asisten AI kami, Anda akan dihubungkan langsung ke Bagian Pemesanan resmi kami via WhatsApp atau Telegram untuk negosiasi kontrak, estimasi harga satuan, dan penetapan tanggal deadline pengiriman.",
      },
      {
        q: "Apakah Lukla juga memproduksi brand miliknya sendiri?",
        a: "Ya, Lukla Manufacturing memproduksi brand internal Snøhund bersamaan dengan melayani mitra maklon B2B. Kedua jalur produksi ini berjalan secara paralel dengan pemisahan inventaris dan lini kerja yang ketat di bawah satu sistem manajemen mutu.",
      },
    ],
  },

  closingCta: {
    badge: "Siap Bermitra?",
    title: "Mulai Rencana Produksi Garmen Anda Bersama Kami",
    subtitle:
      "Konsultasikan kebutuhan pakaian outdoor, kemeja seragam, atau koleksi fashion brand Anda dengan tim berpengalaman kami di Ciwidey.",
    ctaPrimary: "Mulai Diskusi via Asisten AI",
    ctaPrimaryHref: "/ai-assistant",
    ctaSecondary: "Hubungi Bagian Pemesanan",
  },

  footer: {
    brandName: "Lukla Operations Engine",
    companyName: "PT Lukla Manufaktur Indonesia (Lukla Manufacturing)",
    address: "Jl. Raya Ciwidey No. 142, Kabupaten Bandung, Jawa Barat (Placeholder Lokasi Pabrik)",
    copyright: "© 2026 Lukla Manufacturing. Hak Cipta Dilindungi.",
    disclaimer:
      "Platform digital operasional terintegrasi untuk brand internal Snøhund dan klien maklon B2B. Kapasitas lini dinamis hingga ±70 mesin aktif.",
    columns: [
      {
        title: "Platform",
        links: [
          { label: "Dashboard Operasional", href: "/dashboard" },
          { label: "Portal Klien Maklon", href: "/portal-klien" },
          { label: "Asisten Calon Klien", href: "/ai-assistant" },
          { label: "Login Karyawan", href: "/login" },
        ],
      },
      {
        title: "Skema Kerja Sama",
        links: [
          { label: "Skema CMT", href: "#skema" },
          { label: "Skema Semi-CMT", href: "#skema" },
          { label: "Full Package (CMT + Bahan)", href: "#skema" },
          { label: "Katalog Brand Snøhund", href: "#skema" },
        ],
      },
      {
        title: "Kendali Mutu",
        links: [
          { label: "Anti-Kontaminasi Silang", href: "#fitur" },
          { label: "Pencatatan 30 Menit", href: "#fitur" },
          { label: "Inspeksi Kualitas QC", href: "#alur" },
          { label: "Audit Lock Payroll", href: "#fitur" },
        ],
      },
      {
        title: "Kontak & Lokasi",
        links: [
          { label: "WhatsApp Pemesanan", href: "https://wa.me/6281234567890" },
          { label: "Telegram Tim Maklon", href: "https://t.me/lukla_manufacturing" },
          { label: "Kawasan Pabrik Ciwidey", href: "#faq" },
          { label: "Kebijakan Privasi Klien", href: "#" },
        ],
      },
    ],
  },
};
