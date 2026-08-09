import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios";
import ENV_LOADER from "../configurations/envLoader";
import {clURL} from "../commonTypes/clURL";

const MAX_PENDING_REQUESTS = 256;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_MS = 500;
const MAX_NCBI_URL_LENGTH = 8_192;
const MAX_NCBI_IDS = 64;
const MAX_SEARCH_RESULTS = 20;
const MAX_SEARCH_OFFSET = 10_000;
const MAX_SEARCH_TERM_LENGTH = 500;

const IDENTIFIER_PATTERN = /^(?:\d+|[A-Z]{1,6}_?\d+(?:\.\d+)?)$/iu;

const requireOnlyParameters = (url: URL, allowed: ReadonlySet<string>): void => {
    for (const key of url.searchParams.keys()) {
        if (!allowed.has(key)) throw new Error(`Unsupported NCBI parameter: ${key}`);
    }
};

const requireDatabase = (url: URL, allowed: ReadonlySet<string>): string => {
    const database = url.searchParams.get("db")?.trim().toLowerCase() ?? "";
    if (!allowed.has(database)) throw new Error("Unsupported or missing NCBI database.");
    return database;
};

const requireBoundedInteger = (
    url: URL,
    key: string,
    minimum: number,
    maximum: number,
    fallback?: number,
): number => {
    const raw = url.searchParams.get(key);
    if (raw === null && fallback !== undefined) return fallback;
    if (raw === null || !/^\d+$/u.test(raw)) throw new Error(`Invalid NCBI ${key} parameter.`);
    const value = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(`NCBI ${key} is outside the supported range.`);
    }
    return value;
};

const requireIdentifiers = (url: URL): readonly string[] => {
    const identifiers = (url.searchParams.get("id") ?? "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
    if (identifiers.length === 0 || identifiers.length > MAX_NCBI_IDS) {
        throw new Error(`NCBI requests must contain between 1 and ${MAX_NCBI_IDS} identifiers.`);
    }
    if (identifiers.some(identifier => !IDENTIFIER_PATTERN.test(identifier))) {
        throw new Error("NCBI request contains an invalid identifier.");
    }
    if (new Set(identifiers.map(identifier => identifier.toUpperCase())).size !== identifiers.length) {
        throw new Error("NCBI request contains duplicate identifiers.");
    }
    return identifiers;
};

const validateNcbiQuery = (url: URL, endpoint: string): void => {
    const credentials = ["tool", "email", "api_key"] as const;
    if (endpoint === "esearch.fcgi") {
        requireOnlyParameters(url, new Set(["db", "term", "retstart", "retmax", "retmode", "sort", "usehistory", ...credentials]));
        requireDatabase(url, new Set(["nuccore", "nucleotide", "taxonomy"]));
        const term = url.searchParams.get("term")?.trim() ?? "";
        if (!term || term.length > MAX_SEARCH_TERM_LENGTH) throw new Error("NCBI search term is empty or too long.");
        requireBoundedInteger(url, "retstart", 0, MAX_SEARCH_OFFSET, 0);
        requireBoundedInteger(url, "retmax", 1, MAX_SEARCH_RESULTS, 5);
        if ((url.searchParams.get("retmode") ?? "json") !== "json") throw new Error("NCBI search must use JSON mode.");
        if (url.searchParams.has("sort") && url.searchParams.get("sort") !== "relevance") {
            throw new Error("Unsupported NCBI search order.");
        }
        if (url.searchParams.has("usehistory") && url.searchParams.get("usehistory") !== "y") {
            throw new Error("Unsupported NCBI history option.");
        }
        return;
    }

    if (endpoint === "esummary.fcgi") {
        requireOnlyParameters(url, new Set(["db", "id", "retmode", "version", ...credentials]));
        requireDatabase(url, new Set(["nuccore", "nucleotide", "taxonomy"]));
        requireIdentifiers(url);
        if ((url.searchParams.get("retmode") ?? "json") !== "json") throw new Error("NCBI summary must use JSON mode.");
        if (url.searchParams.has("version") && url.searchParams.get("version") !== "2.0") {
            throw new Error("Unsupported NCBI summary version.");
        }
        return;
    }

    if (endpoint === "efetch.fcgi") {
        requireOnlyParameters(url, new Set(["db", "id", "rettype", "retmode", ...credentials]));
        requireDatabase(url, new Set(["nuccore", "nucleotide"]));
        requireIdentifiers(url);
        if (url.searchParams.get("rettype") !== "fasta" || url.searchParams.get("retmode") !== "text") {
            throw new Error("NCBI fetch is restricted to FASTA text.");
        }
    }
};

const wait = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds));

export class NcbiQueueFullError extends Error {}

export const prepareNcbiUrl = (rawUrl: string): clURL => {
    if (rawUrl.length > MAX_NCBI_URL_LENGTH) throw new Error("NCBI request URL is too long.");
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
    validateNcbiQuery(url, endpoint);
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
    if (axios.isCancel(error) || error.code === "ERR_CANCELED") return false;
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
        if (config.signal?.aborted) throw new axios.CanceledError("NCBI request was cancelled.");
        if (this.pending >= MAX_PENDING_REQUESTS) throw new NcbiQueueFullError("The NCBI request queue is full. Try again shortly.");
        this.pending += 1;

        await this.acquireSlot();

        try {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
                try {
                    // Retries consume the same NCBI rate budget as first attempts.
                    // Re-enter the shared start queue before every upstream call.
                    await this.waitForRateSlot();
                    if (config.signal?.aborted) throw new axios.CanceledError("NCBI request was cancelled.");
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
