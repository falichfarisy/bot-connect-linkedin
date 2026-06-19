export interface ConnectOptions {
    maxPerSession: number;
    delayMinMs: number;
    delayMaxMs: number;
    maxScrolls: number;
    /** Hanya kirim koneksi ke profil dengan kata kunci HR (HR IT filter). */
    hrFilter?: boolean;
    /** Maksimal refresh halaman kalau semua profil di-filter (default 10). */
    maxRefreshes?: number;
}

export interface ConnectResult {
    sent: number;
    skipped: number;
    errors: number;
    limitReached: boolean;
    stopped: boolean;
}