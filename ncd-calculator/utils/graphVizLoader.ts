// src/utils/graphvizLoader.ts
export async function loadGraphviz() {
	try {
		// Check if already loaded via a global variable
		if (window.hpccGraphviz) {
			return window.hpccGraphviz;
		}
		
		const script = document.createElement('script');
		script.src = 'https://unpkg.com/@hpcc-js/wasm@2.22.4/dist/index.umd.js';
		script.async = true;
		
		// Wait for the script to load
		await new Promise((resolve, reject) => {
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
		
		// Initialize the graphviz instance
		if (window.hpccWasm?.Graphviz) {
			const instance = await window.hpccWasm.Graphviz.load();
			// Store for reuse
			window.hpccGraphviz = instance;
			return instance;
		} else {
			throw new Error('Failed to load GraphViz library from script');
		}
	} catch (error) {
		console.error('GraphViz loading error:', error);
		throw error;
	}
}

// Add typings for global variables
declare global {
	interface Window {
		hpccWasm?: {
			Graphviz?: {
				load: () => Promise<any>;
			};
		};
		hpccGraphviz?: any;
	}
}
