/// <reference lib="webworker" />
import {LabelManager} from "@/functions/labelUtils.ts";
// Import the Emscripten module
import Module from "../wasm/qsearch.ts";
import {getTreeInput} from "../functions/qtree.ts";
import {validateMatrix} from "@/functions/matrix.ts";

interface EmscriptenModule {
	run_qsearch: (
		matrixString: string,
		callback: (treeJSON: string) => void
	) => void;
}

interface QSearchModuleConfig {
	print: (text: string) => void;
	printErr: (text: string) => void;
}

// Define message types
interface ProcessNcdMatrixMessage {
	action: "processNcdMatrix";
	labels: string[];
	ncdMatrix: number[][];
}

interface TestConnectionMessage {
	action: "testConnection";
}

interface ConsoleMessage {
	action: "consoleLog" | "consoleError";
	message: string;
}

export interface TreeJSONMessage {
	action: "treeJSON";
	result: string;
}

interface QSearchCompleteMessage {
	action: "qsearchComplete";
}

interface QSearchErrorMessage {
	action: "qsearchError";
	message: string;
}

type WorkerMessage =
	| ProcessNcdMatrixMessage
	| TestConnectionMessage
	| ConsoleMessage
	| TreeJSONMessage
	| QSearchCompleteMessage
	| QSearchErrorMessage;

let qsearchModule: EmscriptenModule | null = null;

// Create a fallback tree when the C++ function fails or returns invalid data
function createFallbackTree(labels: string[]): string {
	self.postMessage({
		action: "consoleLog",
		message: "Creating fallback tree for " + labels.length + " labels"
	} as ConsoleMessage);
	
	// Create nodes with 3D coordinates
	const nodes = labels.map((label, index) => {
		// Create a circle layout
		const angle = (index / labels.length) * Math.PI * 2;
		const radius = 10;
		
		return {
			id: index,
			label: label,
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius,
			z: 0
		};
	});
	
	// Create edges connecting adjacent nodes
	const edges = [];
	for (let i = 0; i < nodes.length - 1; i++) {
		edges.push({
			source: i,
			target: i + 1
		});
	}
	
	// Close the circle
	if (nodes.length > 2) {
		edges.push({
			source: nodes.length - 1,
			target: 0
		});
	}
	
	return JSON.stringify({nodes, edges});
}

// Ensure the tree JSON has the necessary fields for visualization
function ensureValidTreeJSON(treeJSON: string, labels: string[]): string {
	let tree;
	
	// First try to parse the JSON
	try {
		tree = JSON.parse(treeJSON);
	} catch (e) {
		self.postMessage({
			action: "consoleError",
			message: "Invalid tree JSON, creating fallback tree: " + e
		} as ConsoleMessage);
		
		return createFallbackTree(labels);
	}
	
	// Check if the tree has the required structure
	if (!tree || typeof tree !== 'object') {
		self.postMessage({
			action: "consoleError",
			message: "Tree data is not an object, creating fallback tree"
		} as ConsoleMessage);
		
		return createFallbackTree(labels);
	}
	
	// Ensure nodes array exists and has the right format
	if (!tree.nodes || !Array.isArray(tree.nodes) || tree.nodes.length === 0) {
		self.postMessage({
			action: "consoleLog",
			message: "Tree is missing nodes array, creating nodes from labels"
		} as ConsoleMessage);
		
		// Create nodes with 3D coordinates
		tree.nodes = labels.map((label, index) => {
			const angle = (index / labels.length) * Math.PI * 2;
			const radius = 10;
			
			return {
				id: index,
				label: label,
				x: Math.cos(angle) * radius,
				y: Math.sin(angle) * radius,
				z: 0
			};
		});
	} else {
		// Ensure all nodes have the required properties
		tree.nodes.forEach((node: any, index: number) => {
			if (node.id === undefined) {
				node.id = index;
			}
			
			if (!node.label) {
				node.label = labels[index] || `Node ${index}`;
			}
			
			// Add 3D coordinates if missing
			if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') {
				const angle = (index / tree.nodes.length) * Math.PI * 2;
				const radius = 10;
				
				node.x = typeof node.x === 'number' ? node.x : Math.cos(angle) * radius;
				node.y = typeof node.y === 'number' ? node.y : Math.sin(angle) * radius;
				node.z = typeof node.z === 'number' ? node.z : 0;
			}
		});
	}
	
	// Ensure edges array exists
	if (!tree.edges || !Array.isArray(tree.edges) || tree.edges.length === 0) {
		self.postMessage({
			action: "consoleLog",
			message: "Tree is missing edges array, creating minimal spanning tree"
		} as ConsoleMessage);
		
		// Create edges
		tree.edges = [];
		
		// Create a minimal spanning tree
		for (let i = 0; i < tree.nodes.length - 1; i++) {
			tree.edges.push({
				source: i,
				target: i + 1
			});
		}
	}
	
	return JSON.stringify(tree);
}

// Initialize the Emscripten module
Module({
	print: (text: string) => {
		// Capture the standard output and send it to the main thread
		self.postMessage({
			action: "consoleLog",
			message: text,
		} as ConsoleMessage);
	},
	printErr: (text: string) => {
		// Capture the error output and send it to the main thread
		self.postMessage({
			action: "consoleError",
			message: text,
		} as ConsoleMessage);
	},
} as QSearchModuleConfig).then((initializedModule: any) => {
	qsearchModule = initializedModule;
	self.postMessage({
		action: "consoleLog",
		message: "Emscripten Module Initialized",
	} as ConsoleMessage);
	
	self.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
		const {action} = event.data;
		
		self.postMessage({
			action: "consoleLog",
			message: "qsearchWorker received message: " + action,
		} as ConsoleMessage);
		
		// Handle test connection request
		if (action === "testConnection") {
			self.postMessage({
				action: "consoleLog",
				message: "QSearchWorker connection test successful"
			} as ConsoleMessage);
			return;
		}
		
		// Handle the processNcdMatrix action
		if (action === "processNcdMatrix") {
			const {labels, ncdMatrix} = event.data;
			
			self.postMessage({
				action: "consoleLog",
				message: "Processing matrix with " + labels.length + " labels"
			} as ConsoleMessage);
			
			// Validate the matrix
			const validationError = validateMatrix(labels, ncdMatrix);
			if (validationError) {
				self.postMessage({
					action: "qsearchError",
					message: "Matrix validation failed: " + validationError
				} as QSearchErrorMessage);
				return;
			}
			
			// Format the NCD matrix as a string for passing to QSearch
			let matrixString = getTreeInput({labels, ncdMatrix});
			
			self.postMessage({
				action: "consoleLog",
				message: "Formatted matrix for qsearch"
			} as ConsoleMessage);
			
			try {
				const callback = (treeJSON: string) => {
					self.postMessage({
						action: "consoleLog",
						message: "Received tree JSON from C++ function"
					} as ConsoleMessage);
					
					try {
						// Ensure the tree JSON is valid and has all necessary fields
						const validTreeJSON = ensureValidTreeJSON(treeJSON, labels);
						
						// Get LabelManager instance
						const labelManager = LabelManager.getInstance();
						
						// Log the labels being used for processing
						self.postMessage({
							action: "consoleLog",
							message: "Processing tree with labels: " + JSON.stringify(labels)
						} as ConsoleMessage);
						
						// Before processing, register all labels if they're not already registered
						// This is important for imported matrices with special characters
						labels.forEach(label => {
							if (!labelManager.getDisplayLabel(label)) {
								labelManager.registerLabel(label, label);
								
								self.postMessage({
									action: "consoleLog",
									message: `Registered label: ${label}`
								} as ConsoleMessage);
							}
						});
						
						// Process the tree, replacing internal labels with display labels
						const processedTreeJSON = labelManager.processTreeJSON(validTreeJSON, labels);
						
						// Send the processed tree JSON to the main thread
						self.postMessage({
							action: "treeJSON",
							result: processedTreeJSON,
						} as TreeJSONMessage);
					} catch (error) {
						self.postMessage({
							action: "consoleError",
							message: "Error processing tree: " + error
						} as ConsoleMessage);
						
						// If processing fails, send the original tree JSON
						self.postMessage({
							action: "treeJSON",
							result: validTreeJSON,
						} as TreeJSONMessage);
					}
				};
				
				// Check if module is initialized
				if (!qsearchModule) {
					throw new Error("QSearch module not initialized");
				}
				
				// Pass the matrix string to the C++ function
				self.postMessage({
					action: "consoleLog",
					message: "Calling C++ run_qsearch function"
				} as ConsoleMessage);
				
				qsearchModule.run_qsearch(matrixString, callback);
				
				self.postMessage({
					action: "consoleLog",
					message: "C++ function call completed"
				} as ConsoleMessage);
				
				self.postMessage({
					action: "qsearchComplete",
				} as QSearchCompleteMessage);
			} catch (error) {
				self.postMessage({
					action: "consoleError",
					message: "QSearch error: " + (error instanceof Error ? error.message : String(error))
				} as ConsoleMessage);
				
				self.postMessage({
					action: "qsearchError",
					message: "QSearch internal error: " + (error instanceof Error ? error.message : String(error)),
				} as QSearchErrorMessage);
				
				// Try to create a fallback tree
				try {
					const fallbackTree = createFallbackTree(labels);
					
					self.postMessage({
						action: "consoleLog",
						message: "Created fallback tree"
					} as ConsoleMessage);
					
					self.postMessage({
						action: "treeJSON",
						result: fallbackTree,
					} as TreeJSONMessage);
				} catch (fallbackError) {
					self.postMessage({
						action: "consoleError",
						message: "Failed to create fallback tree: " + fallbackError
					} as ConsoleMessage);
				}
			}
		}
	});
}).catch((error: any) => {
	self.postMessage({
		action: "consoleError",
		message: "Failed to initialize Emscripten Module: " + error
	} as ConsoleMessage);
	
	self.postMessage({
		action: "qsearchError",
		message: "QSearch initialization failed: " + error
	} as QSearchErrorMessage);
});

// Add type declaration for Web Worker context
declare const self: DedicatedWorkerGlobalScope;
