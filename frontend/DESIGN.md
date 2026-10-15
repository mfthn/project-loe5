# DESIGN.md — Lukla Operations Engine (project-loe5)
> **Single source of truth untuk semua keputusan visual frontend.**
> Baca file ini sebelum membuat atau memodifikasi komponen UI apapun.

---

## 1. Brand Identity

| Atribut | Nilai |
|---|---|
| **Nama Produk** | Lukla Operations Engine |
| **Sub-brand** | Lukla Manufacturing · Ciwidey |
| **Logo Mark** | Kotak 40×40px, `border-radius: 12px`, gradient `#7C3AED → #2E1065`, teks "LK" bold putih |
| **Tagline** | Pabrik Garmen Terkendali. Transparan dari Cutting hingga Jahit. |
| **Tone** | Profesional, presisi, modern — tanpa ornamen berlebihan |

---

## 2. Color System (60-30-10 Rule)

### 2.1 Primary Palette

```
60% — Putih / Surface
  #FFFFFF   → Background utama, kartu putih terang
  #FAF8FF   → Surface tint lembut (section alternate, inner card)
  #F8F9FC   → Background table header, page body

30% — Ungu Ink (Brand Primary)
  #2E1065   → --color-purple-900  | Heading, navbar brand, teks utama kuat
  #6D28D9   → --color-purple-700  | Hover state button, link aktif
  #7C3AED   → --color-purple-600  | CTA button, border highlight, icon aktif
  #C4B5FD   → --color-purple-300  | Border subtle, garis pemisah, disabled
  #EDE9FE   → --color-purple-100  | Badge chip background, subtle section border

10% — Pink Aksen (Energy / CTA)
  #EC4899   → --color-pink-500    | Dot aktif, indikator, glow ambient, icon pulse
  #BE185D   → --color-pink-700    | Teks pink on-white (AA compliant)
  #FBCFE8   → --color-pink-200    | Ambient orb gradasi, border kartu pink-soft
```

### 2.2 Text Roles

```
--text-primary    #181e4b  → Teks heading, nilai data penting
--text-secondary  #5e6282  → Teks body paragraf
--color-text-muted #5B5870 → Label, meta, placeholder, hint
--jadoo-muted     #84829a  → Label tabel, timestamp sekunder
```

### 2.3 Semantic Colors

| Peran | Warna Teks | Background | Border |
|---|---|---|---|
| Success | `#059669` | `#ecfdf5` | `#a7f3d0` |
| Warning | `#d97706` | `#fffbeb` | `#fde68a` |
| Danger  | `#dc2626` | `#fef2f2` | `#fecaca` |
| Info    | `#0284c7` | `#f0f9ff` | `#bae6fd` |

### 2.4 Warna yang DILARANG
- ❌ Biru primer (`#2563eb`, `#3b82f6`) — tidak digunakan di landing
- ❌ Hijau sebagai aksen primer
- ❌ Merah sebagai warna brand
- ❌ Warna abu-abu generik (`#999`, `#ccc`) tanpa variabel token

---

## 3. Typography

### 3.1 Font Families

```css
--font-sans  : 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
--font-serif : 'Volkhov', Georgia, serif;        /* heading editorial */
--font-mono  : 'JetBrains Mono', monospace;      /* angka data, kode, stopwatch */
```

**Import CDN:**
```
https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Volkhov:ital,wght@0,700;1,700&family=JetBrains+Mono:wght@400;500;700&display=swap
```

### 3.2 Type Scale

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Hero H1 | `clamp(2.75rem, 5.5vw, 4.25rem)` | 800 | `-0.03em` | Warna `#2E1065` |
| Section H2 | `clamp(2rem, 4vw, 2.85rem)` | 800 | `-0.025em` | Warna `#2E1065` |
| Card H3 | `1.35rem–1.65rem` | 800 | default | Warna `#2E1065` |
| Card H4 | `1rem` | 800 | default | Warna `#2E1065` atau `#5B5870` |
| Body | `0.94rem–1.08rem` | 400–500 | default | Line-height `1.6` |
| Label/Meta | `0.72rem–0.82rem` | 600–700 | `0.05em–0.08em` | Uppercase, warna muted |
| Mono Data | `var(--font-mono)` | 700–800 | `-0.04em` | Angka KPI, stopwatch |

### 3.3 Aturan Typography
- **Heading**: Selalu `#2E1065` — tidak ada heading abu-abu
- **Body**: Selalu `#5B5870` atau `#5e6282`
- **Label uppercase**: Tambah `letter-spacing: 0.05em–0.08em`
- **Heading section**: Gunakan `clamp()` agar responsif
- **Editorial accent**: Boleh pakai `font-family: var(--font-serif)` untuk kata kunci hero

---

## 4. Spacing & Layout

### 4.1 Container

```
Max-width   : 1280px
Side padding: 24px (desktop) / 20px (mobile ≤600px)
Centering   : margin: 0 auto
```

### 4.2 Section Padding

```
Section full   : padding: 100px 0
Section medium : padding: 80px 0
Section compact: padding: 60px 0
Section header margin-bottom: 52px–64px
```

### 4.3 Grid Systems

**Landing — Bento Grid (asymmetric):**
```
grid-template-columns: repeat(12, 1fr)
gap: 24px
Kartu besar : span 7 / span 5
Kartu medium: span 6 / span 6
Mobile      : semua span 12 (satu kolom)
```

**Landing — Skema Cards:**
```
grid-template-columns: repeat(3, 1fr)
gap: 28px
Mobile: 1 kolom
```

**Landing — Workflow Stepper:**
```
grid-template-columns: repeat(6, 1fr)
gap: 16px
Mobile: 1 kolom
```

**App Dashboard (sidebar layout):**
```
Sidebar       : 280px fixed, z-index 40
Main content  : margin-left 280px, max-width calc(100vw - 280px)
Topbar        : height 74px, sticky, z-index 30
Page body     : padding 36px (desktop) / 20px (mobile ≤900px)
Stats grid    : auto-fit, minmax(220px, 1fr), gap 20px
```

---

## 5. Border Radius

```
--radius-sm   : 8px    → Tombol kecil, input field
--radius-md   : 14px   → Tombol default, form input, notice
--radius-lg   : 24px   → Card komponen dashboard
--radius-xl   : 36px   → Modal
--radius-full : 9999px → Pill badge, CTA pill button
```

**Landing page spesifik:**
- Bento card, Skema card, Workflow card: `border-radius: 28px`
- Badge pill: `border-radius: 9999px`
- Inner sub-card: `border-radius: 16px–18px`
- Logo mark: `border-radius: 12px`

---

## 6. Shadow System

```css
--shadow-subtle  : 0 2px 8px rgba(24, 30, 75, 0.04)
--shadow-card    : 0 10px 30px rgba(24, 30, 75, 0.06), 0 1px 3px rgba(24, 30, 75, 0.03)
--shadow-hover   : 0 20px 48px rgba(24, 30, 75, 0.1), 0 4px 12px rgba(24, 30, 75, 0.04)
--shadow-coral   : 0 12px 28px -4px rgba(223, 105, 81, 0.35)
--shadow-purple  : 0 12px 28px -4px rgba(98, 70, 229, 0.3)
```

**Landing-specific:**
```
Bento dark card : 0 20px 48px -10px rgba(46, 16, 101, 0.4)
Bento hover     : 0 28px 60px -8px rgba(46, 16, 101, 0.55)
Skema highlight : 0 24px 50px -12px rgba(124, 58, 237, 0.22)
CTA pill purple : 0 12px 28px -4px rgba(124, 58, 237, 0.38)
```

---

## 7. Component Patterns

### 7.1 Navbar (Landing)
- **Sticky** top, `z-index: 50`
- **Awal** (belum scroll): `background: rgba(255,255,255,0.7)`, `backdrop-filter: blur(16px)`, border transparan
- **Setelah scroll**: `background: rgba(255,255,255,0.92)`, `border-bottom: 1px solid rgba(196,181,253,0.35)`, `box-shadow: 0 4px 20px rgba(46,16,101,0.05)`
- **Desktop nav links**: `#5B5870`, hover → `#7C3AED`
- **CTA Login**: Pill ghost, hover border `#C4B5FD` + bg `#FAF8FF`
- **CTA Primary**: Pill solid purple `#7C3AED`, `box-shadow: 0 8px 18px rgba(124,58,237,0.28)`

### 7.2 Section Header (Landing)
Setiap section dimulai dengan pola yang konsisten:
```
1. Badge pill kecil:
   background #EDE9FE, color #6D28D9, border-radius 9999px
   font-size 0.82rem, font-weight 700, margin-bottom 12px

2. H2 Heading:
   font-size clamp(2rem, 4vw, 2.85rem), font-weight 800
   color #2E1065, letter-spacing -0.025em, margin-bottom 16px

3. Subtitle paragraf:
   font-size 1.05–1.08rem, color #5B5870, line-height 1.6
```

### 7.3 CTA Buttons (Landing)

**Primary Pill (solid purple):**
```
background: #7C3AED, color: #ffffff
padding: 12px 20px 12px 28px, border-radius: 9999px
font-weight: 700, font-size: 1rem
box-shadow: 0 12px 28px -4px rgba(124,58,237,0.38)
Trailing circle: 32×32px white bg, icon → warna #7C3AED
Hover: background #6D28D9, translateY(-2px)
```

**Secondary Outline Pill:**
```
background: #ffffff, color: #2E1065
border: 1.5px solid #C4B5FD, border-radius: 9999px
padding: 14px 26px, font-weight: 700
Hover: border-color #7C3AED, background #FAF8FF
```

### 7.4 Badges / Chips

```
Chip default : bg #EDE9FE, color #2E1065, border #C4B5FD
Chip purple  : bg #f3f0ff, color #7C3AED, border #e2d9fd
Chip coral   : bg #fff1ee, color #df6951, border #ffdcd5
Chip pink    : bg rgba(236,72,153,0.15), color #BE185D
Chip success/warning/danger/info: → Semantic Colors §2.3
```

### 7.5 Cards (Dashboard)

```css
.card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);  /* #f1f2f6 */
  border-radius: 24px;
  padding: 26px;
  box-shadow: 0 10px 30px rgba(24,30,75,0.06), 0 1px 3px rgba(24,30,75,0.03);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
  box-shadow: 0 20px 48px rgba(24,30,75,0.1), 0 4px 12px rgba(24,30,75,0.04);
  border-color: #e2e8f0;
}
```

**Stat Card** — tambahan top accent bar:
```
::after: height 4px, gradient linear-gradient(90deg, #df6951, #ff7d68)
```

### 7.6 Bento Cards (Landing)

**Dark card (ungu tua):**
```
background: linear-gradient(145deg, #2E1065 0%, #1E0A45 100%)
border-radius: 28px, border: 1px solid rgba(196,181,253,0.2)
box-shadow: 0 20px 48px -10px rgba(46,16,101,0.4)
Teks heading: #ffffff, body: #C4B5FD
Inner glow: div absolut pink rgba(236,72,153,0.25) blur(50px)
```

**Light card (putih):**
```
background: #ffffff, border: 1.5px solid #EDE9FE
border-radius: 28px, box-shadow: 0 10px 30px rgba(46,16,101,0.05)
Hover: translateY(-4px), border-color #C4B5FD
```

**Pink-soft card:**
```
background: linear-gradient(145deg, #FDF2F8 0%, #FAF5FF 100%)
border: 1.5px solid #FBCFE8
Hover: translateY(-4px), border-color #EC4899
```

### 7.7 Ambient Orb

Komponen: `<AmbientOrb />` dari `src/components/visuals/AmbientOrb.tsx`

```
Warna: HANYA ungu (#C4B5FD, #A78BFA) dan pink (#FBCFE8, #F472B6) — TANPA biru
Gradient: radial-gradient(circle at 35% 35%,
  rgba(244,114,182,0.75) 0%,
  rgba(167,139,250,0.7) 45%,
  rgba(196,181,253,0.45) 70%,
  transparent 100%)
filter: blur(72px–90px), opacity: 0.35–0.65
animation: orb-drift 24s ease-in-out infinite alternate
```

### 7.8 Tables (Dashboard)

```
.table-wrap: border 1px solid #f1f2f6, border-radius 24px, background #ffffff
.table th  : bg #f8f9fc, color #84829a, 0.78rem, weight 700, uppercase, tracking 0.05em
             padding 16px 20px, border-bottom #f1f2f6
.table td  : padding 16px 20px, border-bottom #f1f2f6, color #5e6282
.table tr:hover td: background #fafbfc, color #181e4b
```

### 7.9 Chat Window (AI Assistant)

```
.chat-window: bg #ffffff, border 1px solid #f1f2f6, border-radius 24px, height 600px
.chat-messages: bg #fafbfc, padding 28px, gap 18px

Bubble user (kanan):
  background: linear-gradient(135deg, #df6951 0%, #ff7d68 100%)
  color #ffffff, border-bottom-right-radius: 4px

Bubble AI (kiri):
  bg #ffffff, border 1px solid #f1f2f6, color #181e4b
  border-bottom-left-radius: 4px
```

### 7.10 Modal

```
Backdrop: rgba(20,24,62,0.45), backdrop-filter blur(8px)
Content: bg #ffffff, border-radius 36px, padding 32px
box-shadow: 0 25px 60px -15px rgba(24,30,75,0.25)
max-width: 580px, max-height: 90vh
```

---

## 8. Animation & Transitions

### 8.1 Global Transitions
```
--transition-fast   : 0.15s ease  → Hover states, border-color
--transition-normal : 0.25s ease  → Card lift, sidebar, modal
```

### 8.2 Keyframes
```css
@keyframes float-hero {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50%       { transform: translateY(-8px) rotate(0.4deg); }
}

@keyframes orb-drift {
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(30px, -20px) scale(1.08); }
  100% { transform: translate(-20px, 15px) scale(0.96); }
}
```

### 8.3 Micro-interactions
- **Button hover**: `translateY(-2px)` + shadow atau brightness
- **Card hover**: `translateY(-4px)` + border-color + shadow upgrade
- **Nav link hover**: `#5B5870 → #7C3AED`
- **Workflow step**: border `2px solid #7C3AED`, bg white, shadow saat aktif
- **Active dot**: Pink `#EC4899` solid vs transparent border

### 8.4 Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .hero-floating-element,
  .ambient-orb-gradient { animation: none !important; }
}
```

---

## 9. Section Background Alternation (Landing)

| Section | Background | Border |
|---|---|---|
| Hero | `#FFFFFF` | — |
| BentoGrid | `#FAF8FF` | `1px solid #EDE9FE` (top+bottom) |
| Skema | `#FFFFFF` | — |
| Workflow | `#FAF8FF` | `1px solid #EDE9FE` (top+bottom) |
| Features | `#FFFFFF` | — |
| Stats | Gradient ungu tua | — |
| Portal Klien | `#FAF8FF` | `1px solid #EDE9FE` (top) |
| Asisten | `#FFFFFF` | — |
| FAQ | `#FAF8FF` | `1px solid #EDE9FE` |
| Closing CTA | Gradient ungu tua | — |
| Footer | `#2E1065` | — |

**Aturan**: Tidak boleh dua section putih berturutan tanpa pembeda visual.

---

## 10. App Shell (Dashboard Layout)

```
Sidebar  : 280px fixed left, z-index 40,
           bg gradient ungu tua linear-gradient(180deg, #2E1065 0%, #1E0A45 100%),
           border-right rgba(196,181,253,0.22)
           Menu aktif: pill putih (bg #ffffff, teks #2E1065);
           menu nonaktif: teks lavender #DCD3FA.
           (Amandemen Okt 2026: sidebar gelap agar batas menu vs isi tegas.)
Topbar   : 74px sticky, bg rgba(255,255,255,0.9) blur(12px), z-index 30
           Burger mengatur sidebar: collapse di desktop (>900px),
           overlay + backdrop (z-index 35) di mobile.
Page body: padding 36px desktop, 20px tablet/mobile

Mobile (≤900px):
  Sidebar: translateX(-100%), tampil saat .open
  Main-content: margin-left 0, max-width 100vw
```

---

## 11. Responsive Breakpoints

| Breakpoint | Lebar | Behavior |
|---|---|---|
| Desktop | `> 900px` | Layout penuh, sidebar visible |
| Tablet | `≤ 900px` | Sidebar slide-out, hamburger nav, 1-col hero |
| Mobile | `≤ 600px` | 1-col stats & footer, hero subcards flow |

**Critical overrides (className triggers dari globals.css):**
```
.hero-grid             → 1 kolom
.bento-card-link       → span 12
.skema-grid-container  → 1 kolom
.workflow-stepper      → 1 kolom
.feature-row           → 1 kolom, direction ltr
.portal-grid           → 1 kolom
.asisten-grid          → 1 kolom
.stats-grid-container  → 1fr 1fr (tablet) → 1fr (≤600px)
.footer-grid-container → 1fr 1fr (tablet) → 1fr (≤600px)
```

---

## 12. Component File Map

```
src/
├── app/globals.css               ← CSS variables, utilities, responsive rules
├── components/
│   ├── landing/
│   │   ├── Navbar.tsx            ← Sticky nav + scroll detection
│   │   ├── HeroSection.tsx       ← Hero + AmbientOrb + badge pill
│   │   ├── BentoGrid.tsx         ← 4-kartu asymmetric bento
│   │   ├── SkemaSection.tsx      ← 3 skema kartu (CMT/Semi/Full)
│   │   ├── WorkflowSection.tsx   ← 6-step stepper + spotlight bar
│   │   ├── FeaturesSection.tsx   ← Feature rows
│   │   ├── StatsSection.tsx      ← Stat counter dark bg
│   │   ├── PortalKlienSection.tsx← Portal mockup
│   │   ├── AsistenSection.tsx    ← AI assistant preview
│   │   ├── FaqSection.tsx        ← Accordion FAQ
│   │   ├── ClosingCtaSection.tsx ← Dark CTA penutup
│   │   └── Footer.tsx            ← Footer gelap
│   ├── visuals/
│   │   ├── AmbientOrb.tsx        ← Background glow orb (reusable)
│   │   ├── HeroObject.tsx        ← Hero dashboard visual floating
│   │   └── MiniChart.tsx         ← MiniLineChart & MiniBarChart
│   ├── AppLayout.tsx             ← Shell: Sidebar + Topbar
│   ├── Sidebar.tsx               ← Nav sidebar dashboard
│   ├── TopBar.tsx                ← Header bar dashboard
│   ├── Modal.tsx                 ← Reusable modal
│   └── Notice.tsx                ← Alert/notice banner
└── content/
    └── landing.ts                ← Semua copy text (JANGAN hardcode di TSX)
```

---

## 13. Do & Don't

### ✅ DO
- Gunakan CSS variable (`var(--color-purple-600)`) — bukan hardcode hex
- Gunakan `clamp()` untuk font-size heading agar responsif otomatis
- Tambahkan `transition` pada semua elemen interaktif
- Gunakan `<AmbientOrb />` — bukan orb inline ad-hoc
- Tambahkan copy text di `content/landing.ts`, bukan hardcode di TSX
- Pastikan setiap CTA punya state hover, focus, dan disabled
- Gunakan `aria-hidden="true"` pada elemen dekoratif

### ❌ DON'T
- Jangan gunakan warna biru di landing page
- Jangan gunakan TailwindCSS — sistem ini Vanilla CSS + CSS variables
- Jangan buat shadow baru di luar token yang sudah ada
- Jangan hapus `transition` dari elemen yang sudah ada
- Jangan gunakan font selain 3 font yang sudah di-import
- Jangan ubah `max-width: 1280px` container sembarangan
- Jangan hardcode nilai `z-index` sembarangan — ikuti hierarki:
  `orb(0) → content(2) → nav(50) → modal(100)`

---

## 14. Quick Reference Cheatsheet

```
Brand purple    : #7C3AED      Border subtle  : #EDE9FE
Brand dark      : #2E1065      Border default : #e5e7eb
Brand hover     : #6D28D9      Shadow card    : 0 10px 30px rgba(24,30,75,0.06)
Pink accent     : #EC4899      Shadow hover   : 0 20px 48px rgba(24,30,75,0.1)
Pink text (AA)  : #BE185D      Radius card    : 24px (dashboard), 28px (landing)
Text primary    : #2E1065      Radius pill    : 9999px
Text body       : #5B5870      Radius modal   : 36px
Text muted      : #84829a      Section pad    : 100px 0
Surface light   : #FAF8FF      Container max  : 1280px, padding 0 24px
Badge bg        : #EDE9FE      Font sans      : Plus Jakarta Sans
Badge color     : #6D28D9      Font mono      : JetBrains Mono
Pill CTA bg     : #7C3AED      Font serif     : Volkhov (editorial only)
```
