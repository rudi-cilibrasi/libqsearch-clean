import type {Graphviz as GraphvizRenderer} from "@hpcc-js/wasm/graphviz";

interface GraphvizModule<Renderer> {
    Graphviz: {
        load: () => Promise<Renderer>;
    };
}

type GraphvizModuleImporter<Renderer> = () => Promise<GraphvizModule<Renderer>>;

/**
 * Creates a lazy, single-flight Graphviz loader.
 *
 * Concurrent callers share one WASM initialization. A rejected initialization is
 * deliberately not cached, so a transient module or network failure can be retried.
 */
export const createGraphvizLoader = <Renderer>(
    importModule: GraphvizModuleImporter<Renderer>
): (() => Promise<Renderer>) => {
    let pendingRenderer: Promise<Renderer> | null = null;

    return (): Promise<Renderer> => {
        if (!pendingRenderer) {
            pendingRenderer = importModule()
                .then(({Graphviz}) => Graphviz.load())
                .catch((error: unknown) => {
                    pendingRenderer = null;
                    throw error;
                });
        }

        return pendingRenderer;
    };
};

export const loadGraphviz = createGraphvizLoader<GraphvizRenderer>(
    () => import("@hpcc-js/wasm/graphviz")
);
