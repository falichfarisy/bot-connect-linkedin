# LinkedIn Content Tool

CLI-based tool untuk otomasi konten LinkedIn. Mulai dari membuat draft dengan AI, menjadwalkan postingan, hingga menganalisis performa konten — semuanya dari terminal.

> **Disclaimer**: Tool ini dibuat untuk keperluan edukasi. Gunakan secara bertanggung jawab. LinkedIn memiliki batasan rate limit dan dapat menangguhkan akun jika terdeteksi penggunaan otomatis yang berlebihan.

---

## Fitur Utama

- **AI Content Drafting** — Buat draft konten LinkedIn menggunakan AI dengan anti-slop detection (93 frasa AI yang diblacklist) dan voice profile untuk menjaga konsistensi tulisan
- **Content Calendar** — Jadwalkan dan kelola konten dengan state machine yang memvalidasi setiap transisi status
- **Analytics** — Pantau performa postingan: impressions, reactions, comments, shares, saves, dan engagement rate
- **First Comment Automation** — Otomatis posting komentar pertama setelah publish (dengan delay 2-5 detik agar terlihat natural)

---

## Prerequisites

- [Bun](https://bun.sh) v1.3.5+
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Brave Browser** (opsional) — diperlukan untuk OAuth login yang membuka browser
- **LinkedIn Developer App** — daftar di [LinkedIn Developer Portal](https://www.linkedin.com/developers/) untuk mendapatkan `clientId` dan `clientSecret`. Lihat [docs/LINKEDIN_SETUP.md](docs/LINKEDIN_SETUP.md) untuk panduan lengkap.

---

## Installation

```bash
# Masuk ke direktori project
cd linkedin-content-tool

# Install dependencies
bun install

# Setup config (lihat bagian Konfigurasi)
cp config.json config.json.example
```

---

## Quick Start

```bash
# 1. Login ke LinkedIn
bun run main.ts auth login

# 2. Buat draft pertama
bun run main.ts draft create --topic "Manfaat TypeScript untuk backend"

# 3. Lihat daftar draft
bun run main.ts draft list

# 4. Publish draft
bun run main.ts publish now content/drafts/draft-*.md --mock
```

---

## Konfigurasi

Edit file `config.json` di root project:

```json
{
  "timezone": "Asia/Jakarta",
  "linkedin": {
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "redirectUri": "http://localhost:3000/callback",
    "apiVersion": "202605"
  },
  "ai": {
    "provider": "opencode-go",
    "apiKey": "YOUR_AI_API_KEY",
    "apiEndpoint": "https://api.opencode-go.example.com",
    "model": "claude-sonnet-4",
    "humanizationPasses": 1
  },
  "content": {
    "draftsDir": "content/drafts",
    "voiceProfilesDir": "content/voice-profiles",
    "defaultVoiceProfile": "default",
    "maxPostLength": 3000,
    "maxCommentLength": 1250
  },
  "scheduler": {
    "enabled": false,
    "checkIntervalMinutes": 5,
    "minGapMinutes": 5
  }
}
```

### Penjelasan Konfigurasi

| Section | Field | Deskripsi |
|---------|-------|-----------|
| `timezone` | — | Timezone untuk scheduling (contoh: `Asia/Jakarta`, `UTC`) |
| `linkedin` | `clientId` | Client ID dari LinkedIn Developer App |
| | `clientSecret` | Client Secret dari LinkedIn Developer App |
| | `redirectUri` | URI callback OAuth (default: `http://localhost:3000/callback`) |
| | `apiVersion` | Versi API LinkedIn format `YYYYMM` |
| `ai` | `provider` | Provider AI (saat ini: `opencode-go`) |
| | `apiKey` | API key untuk provider AI |
| | `apiEndpoint` | Endpoint URL provider AI |
| | `model` | Model yang digunakan (contoh: `claude-sonnet-4`) |
| | `humanizationPasses` | Jumlah iterasi anti-slop (1-4, default: `1`) |
| `content` | `draftsDir` | Direktori penyimpanan draft |
| | `voiceProfilesDir` | Direktori voice profiles |
| | `defaultVoiceProfile` | Voice profile default |
| | `maxPostLength` | Panjang maksimum post dalam karakter |
| | `maxCommentLength` | Panjang maksimum komentar dalam karakter |
| `scheduler` | `enabled` | Aktifkan scheduler |
| | `checkIntervalMinutes` | Interval pengecekan scheduler (menit) |
| | `minGapMinutes` | Jarak minimal antar postingan (menit) |

---

## Penggunaan

### `auth` — Autentikasi LinkedIn

```bash
# Login via OAuth 2.0 (membuka browser)
bun run main.ts auth login

# Cek status autentikasi
bun run main.ts auth status

# Refresh token secara manual
bun run main.ts auth refresh
```

**Cara kerja OAuth:**
1. Browser membuka halaman LinkedIn untuk otorisasi
2. Anda login dan memberikan izin
3. Callback ke `localhost:3000/callback` dengan authorization code
4. Code ditukar untuk access token dan disimpan di `config.json`
5. Token auto-refresh jika kurang dari 7 hari sebelum expired

**Output `auth status`:**
- `AUTHENTICATED` — Token aktif
- `TOKEN EXPIRING SOON` — Token akan expired dalam 7 hari
- `NOT AUTHENTICATED` — Belum login

---

### `draft` — Kelola Konten Draft

```bash
# Buat draft baru dengan AI
bun run main.ts draft create --topic "Kenapa harus pakai TypeScript"

# Buat draft dengan angle spesifik
bun run main.ts draft create --topic "Tips coding produktif" --angle contrarian

# Buat draft dengan voice profile tertentu
bun run main.ts draft create --topic "Career advice" --voice-profile professional

# Lihat semua draft
bun run main.ts draft list

# Filter draft berdasarkan status
bun run main.ts draft list --status approved
bun run main.ts draft list --status published

# Tampilkan isi draft
bun run main.ts draft show content/drafts/draft-20260611-143022123-001.md

# Edit draft di editor
bun run main.ts draft edit content/drafts/draft-20260611-143022123-001.md

# Hapus draft (konfirmasi y/N)
bun run main.ts draft delete content/drafts/draft-20260611-143022123-001.md
```

**Opsi `draft create`:**

| Opsi | Wajib | Deskripsi |
|------|-------|-----------|
| `--topic <topic>` | Ya | Topik konten |
| `--angle <angle>` | Tidak | Sudut konten: `contrarian`, `howto`, `story`, `general` |
| `--voice-profile <name>` | Tidak | Voice profile yang digunakan |

**Status Draft:**

```
idea → draft → review → approved → scheduled → published (terminal)
                    ↑         ↓            ↑
                    +---------+            |
                  approved (cancel)  scheduled
```

---

### `publish` — Publish ke LinkedIn

```bash
# Publish draft sekarang
bun run main.ts publish now content/drafts/draft-20260611-143022123-001.md

# Publish dengan mock client (untuk testing)
bun run main.ts publish now content/drafts/draft-20260611-143022123-001.md --mock

# Lihat status publish
bun run main.ts publish status
```

**Catatan:**
- Draft harus berstatus `approved` atau `scheduled` untuk bisa di-publish
- Jika draft memiliki `firstComment`, komentar akan dipost otomatis dengan delay 2-5 detik
- Panjang konten harus <= `maxPostLength` (default: 3000 karakter)

---

### `calendar` — Kelola Content Calendar

```bash
# Tambahkan draft ke calendar
bun run main.ts calendar add content/drafts/draft-20260611-143022123-001.md --at 2026-06-15T08:00:00Z

# Lihat semua item di calendar
bun run main.ts calendar list

# Filter berdasarkan status
bun run main.ts calendar list --status scheduled

# Reschedule item
bun run main.ts calendar move draft-20260611-143022123-001 --to 2026-06-16T10:00:00Z

# Hapus dari calendar (kembali ke approved)
bun run main.ts calendar remove draft-20260611-143022123-001
```

**Format datetime:** ISO 8601 (contoh: `2026-06-15T08:00:00Z`, `2026-06-15T15:00:00+07:00`)

**Validasi Calendar:**
- Draft harus berstatus `approved` atau `scheduled` untuk dijadwalkan
- Tidak boleh ada postingan lain dalam rentang `minGapMinutes` (collision detection)
- Waktu harus di masa depan

---

### `analytics` — Analisis Performa

```bash
# Fetch analytics untuk post tertentu
bun run main.ts analytics fetch --post-urn "urn:li:activity:1234567890"

# Tampilkan laporan dalam format tabel
bun run main.ts analytics report

# Tampilkan laporan dalam format CSV
bun run main.ts analytics report --format csv

# Tampilkan hanya data lengkap
bun run main.ts analytics report --complete-only

# Export ke file CSV
bun run main.ts analytics export --output analytics-report.csv
```

**Metrik yang di-track:**
- **Impressions** — Jumlah orang yang melihat post
- **Reactions** — Jumlah reaksi (like, celebrate, dll)
- **Comments** — Jumlah komentar
- **Shares** — Jumlah share
- **Saves** — Jumlah save/bookmark
- **Engagement Rate** — `(reactions + comments + shares + saves) / impressions`

**Catatan:** Fetch analytics memerlukan scope `r_member_postAnalytics` yang disetujui oleh LinkedIn. Jika belum disetujui, akan mengembalikan data nol dengan peringatan.

---

### `scheduler` — Content Scheduler

```bash
# Jalankan scheduler di foreground
bun run main.ts scheduler start

# Jalankan scheduler dengan mock client (testing)
bun run main.ts scheduler start --mock

# Cek status scheduler
bun run main.ts scheduler status
```

**Cara kerja Scheduler:**
1. Memeriksa database `content_items` setiap `checkIntervalMinutes` menit
2. Jika ada post dengan status `scheduled` dan waktu <= sekarang + 5 menit, post akan dipublish
3. Error per-post ditangani secara individual (satu error tidak menghentikan post lain)
4. Tekan `Ctrl+C` untuk menghentikan scheduler

---

## Contoh Workflow

Berikut langkah-langkah lengkap dari draft sampai publish:

### Langkah 1: Setup Autentikasi

```bash
# Pastikan config.json sudah terisi clientId dan clientSecret
bun run main.ts auth login
bun run main.ts auth status
```

### Langkah 2: Buat Draft

```bash
# Generate draft dengan AI
bun run main.ts draft create --topic "Kenapa saya berhenti pakai framework JavaScript" --angle contrarian

# Lihat draft yang dibuat
bun run main.ts draft list

# Review isi draft
bun run main.ts draft show content/drafts/draft-*.md
```

### Langkah 3: Edit & Approve

```bash
# Edit draft jika perlu
bun run main.ts draft edit content/drafts/draft-*.md
```

Setelah diedit, ubah status di frontmatter YAML dari `draft` ke `approved` (atau lewat workflow `draft → review → approved`).

### Langkah 4: Jadwalkan atau Publish

```bash
# Opsi A: Publish langsung
bun run main.ts publish now content/drafts/draft-*.md

# Opsi B: Jadwalkan untuk nanti
bun run main.ts calendar add content/drafts/draft-*.md --at 2026-06-15T08:00:00Z

# Jalankan scheduler untuk auto-publish
bun run main.ts scheduler start
```

### Langkah 5: Pantau Hasil

```bash
# Fetch analytics post yang sudah publish
bun run main.ts analytics fetch --post-urn "urn:li:activity:xxxxx"

# Lihat laporan
bun run main.ts analytics report
```

---

## Voice Profile

Voice profile membantu menjaga konsistensi gaya tulisan di semua konten. File disimpan di `content/voice-profiles/` dalam format YAML.

```yaml
name: "Default"
sentenceRhythm: "mixed"
openerPattern: "statement"
bannedPhrases: []
closingStyle: "specific_question"
contractionFrequency: "moderate"
examples:
  - "Most companies get this wrong."
  - "Here's what actually works."
```

**Field Voice Profile:**

| Field | Deskripsi |
|-------|-----------|
| `name` | Nama voice profile |
| `sentenceRhythm` | Pola kalimat: `mixed`, `short`, `long` |
| `openerPattern` | Pola pembuka: `statement`, `question`, `story` |
| `bannedPhrases` | Frasa yang tidak boleh digunakan |
| `closingStyle` | Gaya penutup: `specific_question`, `call_to_action`, `reflection` |
| `contractionFrequency` | Frekuensi kontraksi: `low`, `moderate`, `high` |
| `examples` | Contoh kalimat yang sesuai dengan gaya |

Buat voice profile baru dengan menambahkan file `.yaml` di `content/voice-profiles/`.

---

## Anti-Slop Detection

Tool ini dilengkapi fitur anti-slop yang mendeteksi dan mengganti frasa-frasa yang terdengar seperti AI:

**Contoh penggantian otomatis:**
- "delve" → "explore"
- "leverage" → "use"
- "game-changer" → "breakthrough"
- "synergy" → "collaboration"
- "unlock" → "access"

Jumlah iterasi penggantian dikontrol oleh `humanizationPasses` di config (1-4 kali).

---

## Troubleshooting

| Error | Solusi |
|-------|--------|
| `LinkedIn credentials not configured` | Isi `clientId` dan `clientSecret` di `config.json` |
| `Authentication failed` | Pastikan `redirectUri` sesuai dengan yang di LinkedIn Developer App |
| `Token expired` | Jalankan `bun run main.ts auth refresh` |
| `Token refresh failed` | Login ulang: `bun run main.ts auth login` |
| `Cannot schedule draft in status "draft"` | Ubah status draft ke `approved` terlebih dahulu |
| `Cannot publish draft in status "draft"` | Ubah status draft ke `approved` atau `scheduled` terlebih dahulu |
| `Editor exited with an error` | Pastikan editor terinstal (vim, nano, code, dll) atau set variabel `EDITOR` |
| `Analytics scope not approved` | Minta approval scope `r_member_postAnalytics` di LinkedIn Developer Portal |
| `Invalid datetime format` | Gunakan format ISO 8601: `2026-06-15T08:00:00Z` |
| `Scheduler: STOPPED` | Jalankan `bun run main.ts scheduler start` |
| Database lock error | Pastikan tidak ada proses lain yang menggunakan database |

---

## Project Structure

```
linkedin-content-tool/
├── main.ts                           # Entry point CLI (Commander)
├── config.json                       # Konfigurasi user
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript config
│
├── content/
│   ├── drafts/                       # File draft (Markdown + YAML frontmatter)
│   ├── voice-profiles/
│   │   └── default.yaml              # Voice profile default
│   └── templates/                    # Template konten (untuk masa depan)
│
├── data/
│   ├── calendar.db                   # SQLite — calendar & state transitions
│   └── analytics.db                  # SQLite — analytics snapshots
│
├── docs/
│   └── LINKEDIN_SETUP.md             # Panduan setup LinkedIn Developer App
│
└── src/
    ├── cli/                          # CLI command handlers
    │   ├── auth.ts                   # auth login/status/refresh
    │   ├── draft.ts                  # draft create/list/edit/delete/show
    │   ├── publish.ts                # publish now/status
    │   ├── calendar.ts               # calendar add/list/move/remove
    │   ├── analytics.ts              # analytics fetch/report/export
    │   └── scheduler.ts              # scheduler start/status
    │
    ├── config/                       # Konfigurasi & validasi
    │   ├── schema.ts                 # TypeScript interfaces
    │   ├── defaults.ts               # Default config values
    │   └── loader.ts                 # Load/save/validate config
    │
    ├── linkedin/                     # LinkedIn API integration
    │   ├── client.ts                 # LinkedInClient interface
    │   ├── real-client.ts            # Real API client
    │   ├── mock-client.ts            # Mock client (testing)
    │   ├── auth.ts                   # OAuth 2.0 flow
    │   ├── analytics.ts              # Fetch analytics
    │   ├── comment.ts                # First comment posting
    │   ├── rate-limiter.ts           # Sliding window rate limiter
    │   └── types.ts                  # Type definitions
    │
    ├── content/                      # Content management
    │   ├── draft.ts                  # Draft CRUD
    │   ├── drafter.ts               # AI draft generation pipeline
    │   ├── publisher.ts             # Publish to LinkedIn
    │   ├── anti-slop.ts             # Anti-slop detection & replacement
    │   ├── anti-slop-list.ts        # 93 blacklisted phrases
    │   ├── voice-profile.ts         # Voice profile loader
    │   ├── voice-profile-schema.ts  # Voice profile types
    │   └── types.ts                  # Content types
    │
    ├── ai/                           # AI provider integration
    │   ├── provider.ts              # AIProvider interface
    │   ├── prompt-builder.ts        # Prompt construction
    │   ├── opencode-go.ts           # OpenCode Go provider
    │   └── types.ts                  # AI types
    │
    ├── calendar/                     # Calendar state machine
    │   └── state-machine.ts          # States & transitions
    │
    ├── scheduler/                    # Auto-publish scheduler
    │   ├── engine.ts                 # Scheduler engine
    │   └── validation.ts            # Schedule validation
    │
    ├── analytics/                    # Analytics storage
    │   └── storage.ts                # Snapshot CRUD
    │
    ├── db/                           # Database
    │   ├── connection.ts             # SQLite connections
    │   ├── migrate.ts                # Run migrations
    │   └── migrations/               # SQL migration files
    │
    └── utils/                        # Utilities
        └── yaml.ts                   # Minimal YAML parser
```

---

## Technology Stack

| Dependency | Versi | Fungsi |
|------------|-------|--------|
| [Bun](https://bun.sh) | v1.3.5+ | Runtime & package manager |
| [Commander](https://github.com/tj/commander.js) | 15.0.0 | CLI argument parser |
| [chalk](https://github.com/chalk/chalk) | 5.6.2 | Terminal colors |
| [cli-table3](https://github.com/cli-table/cli-table3) | 0.6.5 | Terminal table output |
| [gray-matter](https://github.com/jonschlinkert/gray-matter) | 4.0.3 | YAML frontmatter parser |
| [SQLite](https://bun.sh/docs/api/sqlite) | Built-in | Database (WAL mode) |

---

## License

Proyek ini dibuat untuk keperluan edukasi. Gunakan secara bertanggung jawab dan patuhi [LinkedIn Terms of Service](https://www.linkedin.com/legal/user-agreement).
