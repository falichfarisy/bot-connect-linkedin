# LinkedIn Connection Bot

Bot otomatis untuk mengirim koneksi LinkedIn ke profil yang disarankan. Menggunakan **Puppeteer + Bun** dengan **persistent browser profile** agar session login awet.

> ⚠️ **Disclaimer**: Bot ini dibuat untuk edukasi. Gunakan bijak — LinkedIn punya batasan mingguan (~80-100 invite/minggu). Jangan spam.

## Prerequisites

- [Bun](https://bun.sh) v1.3.5+ — `curl -fsSL https://bun.sh/install | bash`
- [Brave Browser](https://brave.com) (di `/usr/bin/brave`) — atau ganti executablePath di kode kalau pakai Chrome/Chromium

## Instalasi

```bash
# Clone & masuk folder
cd bot_connection_linkedin

# Install dependencies
bun install
```

## Cara Pakai

### Pertama Kali — Login

```bash
bun start
```

Nanti jendela Brave akan terbuka. **Login LinkedIn manual** (email + password). Setelah login berhasil, bot otomatis:
1. Deteksi session aktif
2. Navigasi ke halaman `mynetwork/grow/`
3. Mulai scroll & kirim koneksi

Session login akan disimpan di folder `.browser-profile/`. **Lain kali tinggal `bun start` aja**, gak perlu login ulang.

### Skip Login (Session Udah Ada)

Kalau session `.browser-profile` masih valid, tinggal:

```bash
bun start
```

Bot akan langsung deteksi session, lalu jalan.

## Struktur Project

```
bot_connection_linkedin/
├── get-cookie.ts        # Entry point utama → `bun start`
├── index.ts             # Entry point alternatif (tanpa auto-login)
├── login.ts             # Helper: deteksi apakah session LinkedIn valid
├── src/
│   └── connect.ts       # Modul utama: scroll, klik, deteksi limit/CAPTCHA
├── package.json
├── tsconfig.json
├── .env                 # (opsional) Lingkungan — udah di gitignore
├── .env.example         # Contoh env vars
├── .gitignore
└── .browser-profile/    # Persistent browser profile (session login) — di gitignore
```

### Penjelasan File

| File | Fungsi |
|---|---|
| `get-cookie.ts` | **Main entry**. Buka browser, deteksi/login, navigasi ke suggested profiles, jalankan bot koneksi. |
| `index.ts` | Alternatif entry. Bedanya: gak ada auto-login flow — langsung cek session, kalau gagal kasih error suruh `bun run get-cookie.ts` dulu. |
| `login.ts` | Fungsi `isSessionValid()` — cek apakah halaman LinkedIn sudah login dengan mencari elemen khas (feed, notifikasi, search). |
| `src/connect.ts` | Semua logika bot: scroll tombol Connect, klik dengan random delay, deteksi weekly limit, CAPTCHA, dan session expired. |

## Konfigurasi

Edit parameter di `get-cookie.ts` (baris 122-127):

```ts
const result = await processConnections(page, {
  maxPerSession: 30,       // Maksimal koneksi per sesi
  delayMinMs: 30000,       // Delay minimal antar klik (30 detik)
  delayMaxMs: 90000,       // Delay maksimal antar klik (90 detik)
  maxScrolls: 30,          // Maksimal scroll sebelum berhenti
});
```

### Rekomendasi Delay

| Kecepatan | Delay Min | Delay Max | Aman? |
|---|---|---|---|
| Santai | 60s | 120s | ✅ Paling aman |
| Normal | 30s | 90s | ✅ Cukup aman |
| Cepat | 15s | 45s | ⚠️ Risiko limit lebih cepat |
| Ngebut | 5s | 15s | ❌ Risiko banned |

## Keamanan & Catatan Penting

### Limit Mingguan
LinkedIn membatasi 80-100 invite per minggu (tergantung usia akun). Kalau kena limit:
- Muncul popup "You've reached the weekly invitation limit"
- Tombol Connect ilang
- **Tunggu 1 minggu** — limit reset otomatis
- Limit itu **proteksi, bukan banned**. Aman.

### Banned vs Limit
| Kejadian | Akibat |
|---|---|
| Kena limit (delay terlalu cepat) | Cuma di-stop sementara 1 minggu |
| Kena banned (spam massal, akun palsu) | Akun dihapus permanen |

Jaga delay minimal 30 detik untuk aman.

### .browser-profile
Folder ini menyimpan **session login LinkedIn** (cookies). Session akan persist meskipun browser ditutup. Folder ini sudah di `.gitignore`.

Kalau session expired dan bot minta login ulang:
```bash
# Hapus profile lama, besok login ulang
rm -rf .browser-profile
bun start
```

### Browser Lain
Kalau pakai Chrome/Chromium, ganti `executablePath` di `get-cookie.ts` (baris 13):
```ts
executablePath: "/usr/bin/google-chrome",  // Chrome
executablePath: "/usr/bin/chromium-browser", // Chromium
```

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Browser terbuka tapi bot berhenti | Cek koneksi internet. Refresh manual lalu jalankan ulang. |
| "Session tidak valid" | `bun start` ulang — login manual sekali lagi. |
| Bot gak nemu tombol Connect | LinkedIn lagi limit atau halaman suggested profile kosong. Coba besok. |
| `ERR_TOO_MANY_REDIRECTS` | Hilang dengan persistent profile. Tapi kalau masih muncul, hapus `.browser-profile/` dan login ulang. |
| Bravenya error "executable not found" | Install Brave, atau ganti path ke Chrome/Chromium di kode. |
