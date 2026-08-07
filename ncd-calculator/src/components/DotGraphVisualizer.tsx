import React, {useCallback, useEffect, useRef, useState} from "react";
import type {Graphviz as GraphvizRenderer} from "@hpcc-js/wasm/graphviz";
import {loadGraphviz} from "../services/GraphvizService";
import {createPlanarTreeDot, PlanarTreeData} from "./tree/planarTree";

interface DotGraphVisualizerProps {
    data: PlanarTreeData;
    onClose?: () => void;
}

interface ViewTransform {
    scale: number;
    x: number;
    y: number;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.4;
const FIT_PADDING = 20;

const clampZoom = (zoom: number): number => Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);

export const DotGraphVisualizer: React.FC<DotGraphVisualizerProps> = ({data, onClose}) => {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const svgWrapperRef = useRef<HTMLDivElement | null>(null);
    const svgDimensionsRef = useRef({width: 0, height: 0});
    const pointerRef = useRef<{id: number; x: number; y: number} | null>(null);
    const [graphviz, setGraphviz] = useState<GraphvizRenderer | null>(null);
    const [transform, setTransform] = useState<ViewTransform>({scale: 1, x: 0, y: 0});
    const [containerDimensions, setContainerDimensions] = useState({width: 0, height: 0});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadAttempt, setLoadAttempt] = useState(0);

    const calculateFitScale = useCallback((): number => {
        const {width: svgWidth, height: svgHeight} = svgDimensionsRef.current;
        const {width: containerWidth, height: containerHeight} = containerDimensions;
        if (svgWidth <= 0 || svgHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) return 1;

        return clampZoom(Math.min(
            (containerWidth - FIT_PADDING) / svgWidth,
            (containerHeight - FIT_PADDING) / svgHeight
        ));
    }, [containerDimensions]);

    const fitTree = useCallback((): void => {
        setTransform({scale: calculateFitScale(), x: 0, y: 0});
    }, [calculateFitScale]);

    useEffect(() => {
        let cancelled = false;

        const initializeGraphviz = async (): Promise<void> => {
            try {
                setLoading(true);
                setError(null);
                const renderer = await loadGraphviz();
                if (!cancelled) setGraphviz(renderer);
            } catch (initializationError) {
                if (cancelled) return;
                console.error("Failed to load Graphviz:", initializationError);
                setError(`Failed to load the planar tree renderer: ${initializationError instanceof Error ? initializationError.message : String(initializationError)}`);
                setLoading(false);
            }
        };

        void initializeGraphviz();
        return () => {
            cancelled = true;
        };
    }, [loadAttempt]);

    useEffect(() => {
        const surface = surfaceRef.current;
        if (!surface) return;

        const updateDimensions = (): void => {
            const {width, height} = surface.getBoundingClientRect();
            setContainerDimensions({width, height});
        };

        updateDimensions();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateDimensions);
            return () => window.removeEventListener("resize", updateDimensions);
        }

        const observer = new ResizeObserver(updateDimensions);
        observer.observe(surface);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!graphviz || !surfaceRef.current || containerDimensions.width <= 0) return;

        try {
            setLoading(true);
            setError(null);
            const svg = graphviz.layout(createPlanarTreeDot(data), "svg", "dot");
            const wrapper = document.createElement("div");
            wrapper.className = "quartet-planar__svg";
            wrapper.innerHTML = svg;

            surfaceRef.current.replaceChildren(wrapper);
            svgWrapperRef.current = wrapper;

            const svgElement = wrapper.querySelector("svg");
            if (svgElement) {
                const renderedBounds = svgElement.getBoundingClientRect();
                svgDimensionsRef.current = {
                    width: renderedBounds.width,
                    height: renderedBounds.height,
                };
                svgElement.setAttribute("aria-hidden", "true");
                svgElement.style.display = "block";
            }

            setTransform({scale: calculateFitScale(), x: 0, y: 0});
            setLoading(false);
        } catch (renderError) {
            console.error("Error rendering planar quartet tree:", renderError);
            setError(`Failed to render the planar tree: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
            setLoading(false);
        }
    }, [calculateFitScale, containerDimensions.width, data, graphviz]);

    useEffect(() => {
        if (!svgWrapperRef.current) return;
        svgWrapperRef.current.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
    }, [transform]);

    const changeZoom = (factor: number): void => {
        setTransform(current => ({...current, scale: clampZoom(current.scale * factor)}));
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        pointerRef.current = {id: event.pointerId, x: event.clientX, y: event.clientY};
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        const pointer = pointerRef.current;
        if (!pointer || pointer.id !== event.pointerId) return;

        const deltaX = event.clientX - pointer.x;
        const deltaY = event.clientY - pointer.y;
        pointerRef.current = {...pointer, x: event.clientX, y: event.clientY};
        setTransform(current => ({...current, x: current.x + deltaX, y: current.y + deltaY}));
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
        event.preventDefault();
        changeZoom(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };

    const retryRenderer = (): void => {
        setGraphviz(null);
        setError(null);
        setLoadAttempt(currentAttempt => currentAttempt + 1);
    };

    return (
        <div className="quartet-planar">
            <div className="quartet-planar__controls" role="toolbar" aria-label="Planar tree view controls">
                <button type="button" onClick={() => changeZoom(1 / 1.15)} aria-label="Zoom out">−</button>
                <output aria-label="Current zoom">{Math.round(transform.scale * 100)}%</output>
                <button type="button" onClick={() => changeZoom(1.15)} aria-label="Zoom in">+</button>
                <button type="button" onClick={fitTree}>Fit tree</button>
                <button type="button" onClick={() => setTransform({scale: 1, x: 0, y: 0})}>Reset 100%</button>
            </div>

            <div className="quartet-planar__viewport">
                {loading && <div className="quartet-planar__message" role="status">Laying out the planar tree…</div>}
                {error && (
                    <div className="quartet-planar__message quartet-planar__message--error" role="alert">
                        <strong>Planar tree unavailable</strong>
                        <span>{error}</span>
                        <button type="button" onClick={retryRenderer}>Retry renderer</button>
                        {onClose && <button type="button" onClick={onClose}>Close</button>}
                    </div>
                )}
                <div
                    ref={surfaceRef}
                    className="quartet-planar__surface"
                    role="img"
                    aria-label={`Planar quartet tree containing ${data.nodes.length} nodes`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onWheel={handleWheel}
                />
            </div>

            <p className="quartet-tree__hint">Drag to pan · Scroll or pinch to zoom · Fit tree restores the complete topology</p>
        </div>
    );
};
