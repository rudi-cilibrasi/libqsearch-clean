import {clHostname, clURL} from "../commonTypes/clURL";

export type GenBankHostName = clHostname & { __clHostname: void };

export const ALLOWED_GENBANK_HOSTNAMES: Set<GenBankHostName> = new Set(Array.from([
    "eutils.ncbi.nlm.nih.gov" 
].map(e => e as GenBankHostName)));


// Invalid URL might throw an exception TypeError: Invalid URL
export const addApiKey = (httpVerb: string, uri: clURL, apiKey: string) => {
    const url = new URL(uri);
    const params = url.searchParams;
    params.append("api_key", apiKey);
    return url.toString() as clURL;
}

export const isGenbankHostname = (hostname: clHostname): boolean => {
    return ALLOWED_GENBANK_HOSTNAMES.has(hostname as GenBankHostName);
}
