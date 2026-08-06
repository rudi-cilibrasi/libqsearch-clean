/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_BASE_URL?: string;
    readonly VITE_BASE_URL?: string;
    readonly VITE_AUTH_ENABLED?: string;
    readonly VITE_NCBI_API_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
