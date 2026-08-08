import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios";
import ENV_LOADER from "../configurations/envLoader";
import {clURL} from "../commonTypes/clURL";

const MAX_PENDING_REQUESTS = 256;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_MS = 500;

const wait = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds));

export class NcbiQueueFullError extends Error {}

export const prepareNcbiUrl = (rawUrl: string): clURL => {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.hostname !== "eutils.ncbi.nlm.nih.gov") {
        throw new Error("Only the NCBI E-utilities HTTPS endpoint is allowed.");
    }
    const endpoint = url.pathname.split("/").at(-1);
    if (!url.pathname.startsWith("/entrez/eutils/") || !endpoint || ![
        "esearch.fcgi",
        "esummary.fcgi",
        "efetch.fcgi",
    ].includes(endpoint)) {
        throw new Error("Invalid NCBI E-utilities path.");
    }
    const database = url.searchParams.get("db");
    if (database && !["nuccore", "nucleotide", "taxonomy"].includes(database)) {
        throw new Error("Unsupported NCBI database.");
    }
    url.searchParams.delete("api_key");
    url.searchParams.set("tool", "complearn-ncd");
    if (ENV_LOADER.NCBI_EMAIL) url.searchParams.set("email", ENV_LOADER.NCBI_EMAIL);
    if (ENV_LOADER.GENBANK_API_KEY) url.searchParams.set("api_key", ENV_LOADER.GENBANK_API_KEY);
    return url.toString() as clURL;
};

const retryDelay = (error: AxiosError, attempt: number): number => {
    const retryAfter = error.response?.headers["retry-after"];
    const seconds = Number.parseInt(String(retryAfter ?? ""), 10);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30_000);
    return DEFAULT_RETRY_MS * (2 ** (attempt - 1));
};

const isRetryable = (error: unknown): error is AxiosError => {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    return status === undefined || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
};

export class NcbiRequestScheduler {
    private tail: Promise<void> = Promise.resolve();
    private pending = 0;
    private active = 0;
    private readonly slotWaiters: Array<() => void> = [];
    private nextStart = 0;
    private readonly intervalMs: number;

    constructor(requestsPerSecond = ENV_LOADER.GENBANK_API_KEY ? 10 : 3) {
        this.intervalMs = Math.ceil(1000 / requestsPerSecond);
    }

    private async acquireSlot(): Promise<void> {
        if (this.active >= MAX_CONCURRENT_REQUESTS) {
            await new Promise<void>(resolve => this.slotWaiters.push(resolve));
        }
        this.active += 1;
    }

    private releaseSlot(): void {
        this.active -= 1;
        this.slotWaiters.shift()?.();
    }

    private async waitForRateSlot(): Promise<void> {
        let release!: () => void;
        const previous = this.tail;
        this.tail = new Promise<void>(resolve => { release = resolve; });
        await previous;
        try {
            const delay = Math.max(0, this.nextStart - Date.now());
            if (delay > 0) await wait(delay);
            this.nextStart = Date.now() + this.intervalMs;
        } finally {
            release();
        }
    }

    async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        if (this.pending >= MAX_PENDING_REQUESTS) throw new NcbiQueueFullError("The NCBI request queue is full. Try again shortly.");
        this.pending += 1;

        await this.acquireSlot();

        try {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
                try {
                    // Retries consume the same NCBI rate budget as first attempts.
                    // Re-enter the shared start queue before every upstream call.
                    await this.waitForRateSlot();
                    return await axios.request<T>({
                        ...config,
                        timeout: 30_000,
                        maxContentLength: 160 * 1024 * 1024,
                        maxBodyLength: 2 * 1024 * 1024,
                    });
                } catch (error) {
                    if (attempt === MAX_ATTEMPTS || !isRetryable(error)) throw error;
                    await wait(retryDelay(error, attempt));
                }
            }
            throw new Error("NCBI request retry loop ended unexpectedly.");
        } finally {
            this.pending -= 1;
            this.releaseSlot();
        }
    }
}

export const ncbiRequestScheduler = new NcbiRequestScheduler();
