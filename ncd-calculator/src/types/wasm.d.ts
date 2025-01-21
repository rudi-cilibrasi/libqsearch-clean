// src/types/wasm.d.ts
declare module '*.wasm?url' {
    const url: string;
    export default url;
}

declare module '*.js?url' {
    const url: string;
    export default url;
}