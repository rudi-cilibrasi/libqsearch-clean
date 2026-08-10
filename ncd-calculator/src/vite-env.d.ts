/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_BASE_URL?: string;
    readonly VITE_BASE_URL?: string;
    readonly VITE_AUTH_ENABLED?: string;
    readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
