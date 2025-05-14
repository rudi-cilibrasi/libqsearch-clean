import React, { useEffect, useRef, useState } from 'react';
import createGraph from '../functions/graphExport';


interface DotGraphVisualizerProps {
	data: {
		nodes: {
			index: number;
			label: string;
			connections: number[];
		}[];
	};
	onClose?: () => void;
}

export const DotGraphVisualizer: React.FC<DotGraphVisualizerProps> = ({ data, onClose }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [graphviz, setGraphviz] = useState<any>(null);
	const [zoom, setZoom] = useState<number>(1);
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const svgWrapperRef = useRef<HTMLDivElement | null>(null);
	const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
	const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
	
	// Initialize graphviz using the proper load method
	useEffect(() => {
		const initGraphviz = async () => {
			try {
				setLoading(true);
				const { Graphviz } = await import('@hpcc-js/wasm');
				const graphvizInstance = await Graphviz.load();
				setGraphviz(graphvizInstance);
			} catch (err) {
				console.error('Failed to load Graphviz:', err);
				setError(`Failed to load Graphviz visualization library: ${err instanceof Error ? err.message : String(err)}`);
				setLoading(false);
			}
		};
		
		initGraphviz();
	}, []);
	
	// Update container dimensions whenever the window size changes
	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				const { width, height } = containerRef.current.getBoundingClientRect();
				setContainerDimensions({ width, height });
			}
		};
		
		// Initial measurement
		updateDimensions();
		
		// Set up listener for resize events
		window.addEventListener('resize', updateDimensions);
		
		// Force an additional dimension update after a brief delay
		// This helps with more accurate initial measurements
		const timeoutId = setTimeout(updateDimensions, 100);
		
		return () => {
			window.removeEventListener('resize', updateDimensions);
			clearTimeout(timeoutId);
		};
	}, []);
	
	// Create an enhanced DOT graph with styling for better visualization
	const createEnhancedGraph = (data: any): string => {
		// First create the basic DOT string
		const baseDotString = createGraph(data, false);
		
		// Enhance with additional styling for better visualization
		const lines = baseDotString.split('\n');
		const firstLine = lines[0];
		
		// Check if it's a digraph or graph
		const isDigraph = firstLine.trim().startsWith('digraph');
		const graphType = isDigraph ? 'digraph' : 'graph';
		
		// Create enhanced first line with styling to make it fit better
		const enhancedFirstLine = `${graphType} G {
  graph [bgcolor="transparent", rankdir=LR, overlap=false, splines=true, nodesep=0.2, ranksep=0.3, fontname="Arial", pad=0.2, margin=0];
  node [shape=ellipse, style=filled, fillcolor="white", color="black", fontname="Arial", fontsize=10, margin="0.1,0.1", height=0.3, width=0.3, fixedsize=false];
  edge [color="#555555", penwidth=0.8, fontname="Arial", fontsize=9];`;
		
		// Replace first line
		lines[0] = enhancedFirstLine;
		
		// Return enhanced DOT string
		return lines.join('\n');
	};
	
	// Render the graph when graphviz is loaded and data changes
	useEffect(() => {
		const renderGraph = async () => {
			if (!graphviz || !data?.nodes || !containerRef.current) return;
			
			try {
				setLoading(true);
				
				// Generate the DOT format string with enhanced styling
				const dotString = createEnhancedGraph(data);
				
				// Use the layout method to render the graph
				const svgString = graphviz.layout(dotString, "svg", "dot");
				
				// Clear previous content
				if (containerRef.current) {
					containerRef.current.innerHTML = '';
					
					// Create a SVG wrapper div that fills the container
					const wrapper = document.createElement('div');
					wrapper.style.position = 'absolute';
					wrapper.style.inset = '0';
					wrapper.style.display = 'flex';
					wrapper.style.justifyContent = 'center';
					wrapper.style.alignItems = 'center';
					wrapper.style.overflow = 'hidden';
					wrapper.style.backgroundColor = 'white'; // Match your design
					
					// Create inner wrapper for transform operations
					const svgWrapper = document.createElement('div');
					svgWrapper.style.transform = `scale(${zoom})`;
					svgWrapper.style.transformOrigin = 'center center';
					svgWrapper.style.transition = 'transform 0.1s ease';
					svgWrapper.innerHTML = svgString;
					
					// Add the SVG wrapper to the main wrapper
					wrapper.appendChild(svgWrapper);
					containerRef.current.appendChild(wrapper);
					svgWrapperRef.current = svgWrapper;
					
					// Extract SVG element to get its dimensions
					const svgElement = svgWrapper.querySelector('svg');
					if (svgElement) {
						// Get container dimensions
						const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
						
						// Get SVG dimensions
						let svgWidth = parseFloat(svgElement.getAttribute('width') || '0');
						let svgHeight = parseFloat(svgElement.getAttribute('height') || '0');
						
						// Store original dimensions for later calculations
						setSvgDimensions({ width: svgWidth, height: svgHeight });
						
						// Calculate optimal scale to fit with some padding
						const padding = 20; // 10px padding on each side
						const scaleX = (containerWidth - padding) / svgWidth;
						const scaleY = (containerHeight - padding) / svgHeight;
						const optimalScale = Math.min(scaleX, scaleY, 1);
						
						// Set the optimized zoom level for perfect fit
						setZoom(optimalScale);
						svgWrapper.style.transform = `scale(${optimalScale})`;
						
						// Ensure SVG fills its container
						svgElement.style.display = 'block';
						svgElement.style.margin = 'auto';
					}
				}
				
				setLoading(false);
			} catch (err) {
				console.error('Error rendering graph:', err);
				setError(`Failed to render graph visualization: ${err instanceof Error ? err.message : String(err)}`);
				setLoading(false);
			}
		};
		
		renderGraph();
	}, [graphviz, data, containerDimensions]);
	
	// Update zoom when it changes
	useEffect(() => {
		if (svgWrapperRef.current) {
			svgWrapperRef.current.style.transform = `scale(${zoom})`;
		}
	}, [zoom]);
	
	// Handle mouse events for panning
	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button === 0) { // Left mouse button only
			setIsDragging(true);
			setDragStart({ x: e.clientX, y: e.clientY });
			e.preventDefault();
		}
	};
	
	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isDragging && svgWrapperRef.current) {
			const dx = e.clientX - dragStart.x;
			const dy = e.clientY - dragStart.y;
			
			// Update the translation of the SVG wrapper
			const currentTransform = window.getComputedStyle(svgWrapperRef.current).transform;
			const matrix = new DOMMatrix(currentTransform);
			
			// Apply the translation
			svgWrapperRef.current.style.transform = `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e + dx}, ${matrix.f + dy})`;
			
			// Update drag start position
			setDragStart({ x: e.clientX, y: e.clientY });
		}
	};
	
	const handleMouseUp = () => {
		setIsDragging(false);
	};
	
	// Handle zoom with buttons and wheel
	const handleZoomIn = () => {
		setZoom(prev => Math.min(prev * 1.1, 2));
	};
	
	const handleZoomOut = () => {
		setZoom(prev => Math.max(prev / 1.1, 0.1));
	};
	
	const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		e.preventDefault();
		const delta = -Math.sign(e.deltaY) * 0.02;
		const newZoom = Math.max(0.1, Math.min(1.5, zoom + delta));
		setZoom(newZoom);
	};
	
	// Reset view to optimal fit
	const handleResetView = () => {
		if (containerRef.current && svgWrapperRef.current && svgDimensions.width > 0) {
			// Reset SVG wrapper's transform to only scale, no translation
			const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
			
			// Calculate optimal scale
			const padding = 20;
			const scaleX = (containerWidth - padding) / svgDimensions.width;
			const scaleY = (containerHeight - padding) / svgDimensions.height;
			const optimalScale = Math.min(scaleX, scaleY, 1);
			
			// Reset zoom and center the graph
			setZoom(optimalScale);
			svgWrapperRef.current.style.transform = `scale(${optimalScale})`;
		}
	};
	
	return (
		<div className="flex flex-col h-full">
			{/* Main visualization container */}
			<div className="flex-1 relative overflow-hidden bg-white">
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-80 z-10">
						<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
						<span className="ml-3 text-white">Loading visualization...</span>
					</div>
				)}
				
				{error && (
					<div className="absolute inset-0 flex items-center justify-center z-10">
						<div className="bg-red-100 text-red-700 p-4 rounded-lg max-w-md">
							<h3 className="font-bold">Error</h3>
							<p>{error}</p>
							{onClose && (
								<button
									onClick={onClose}
									className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
								>
									Close
								</button>
							)}
						</div>
					</div>
				)}
				
				{/* Graph container */}
				<div
					ref={containerRef}
					className="w-full h-full cursor-move relative"
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
					onWheel={handleWheel}
				/>
			</div>
			
			{/* Controls overlay - positioned absolutely at the top-right */}
			<div className="absolute top-4 left-4 flex items-center space-x-2 z-20">
				<span className="text-sm bg-gray-800 text-white px-2 py-1 rounded">
          {Math.round(zoom * 100)}%
        </span>
				<button
					onClick={handleZoomIn}
					className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
					title="Zoom In"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						<line x1="11" y1="8" x2="11" y2="14"></line>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
				<button
					onClick={handleZoomOut}
					className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
					title="Zoom Out"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
			</div>
			
			{/* Instructions at the bottom */}
			<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black bg-opacity-70 text-white text-xs rounded-md z-20">
				Pan: Click and drag | Zoom: Use buttons or mouse wheel
			</div>
		</div>
	);
};
