export interface QSearchWasmModule {
  run_qsearch_seeded(matrixInput: string, seed: number): string;
}

export interface QSearchWasmOptions {
  print?: (message: string) => void;
  printErr?: (message: string) => void;
}

export default function createQSearchModule(
  options?: QSearchWasmOptions,
): Promise<QSearchWasmModule>;
