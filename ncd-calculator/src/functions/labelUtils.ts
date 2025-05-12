export class LabelManager {
	private static instance: LabelManager;
	private labelMapping: Map<string, string>;
	private originalToSanitizedMap: Map<string, string>; // For QSearch algorithm
	private sanitizedToOriginalMap: Map<string, string>; // For QSearch algorithm
	
	private constructor() {
		this.labelMapping = new Map<string, string>();
		this.originalToSanitizedMap = new Map<string, string>();
		this.sanitizedToOriginalMap = new Map<string, string>();
		console.log("LabelManager instance created with sanitization support");
	}
	
	public static getInstance(): LabelManager {
		if (!LabelManager.instance) {
			LabelManager.instance = new LabelManager();
			console.log("Created new LabelManager instance");
		}
		return LabelManager.instance;
	}
	
	/**
	 * Register a label with its display form
	 */
	public registerLabel(id: string, displayLabel: string): void {
		if (!id) {
			console.warn("Attempted to register empty ID");
			return;
		}
		
		console.log(`LabelManager: Registering ${id} -> ${displayLabel}`);
		this.labelMapping.set(id, displayLabel);
		
		// Verify registration succeeded
		console.log(`LabelManager: After registration, mapping for ${id} -> ${this.getDisplayLabel(id)}`);
	}
	
	/**
	 * Get the display label for an ID
	 */
	public getDisplayLabel(id: string): string | undefined {
		if (!id) return undefined;
		
		const displayLabel = this.labelMapping.get(id);
		// console.log(`LabelManager: Getting display label for ${id} -> ${displayLabel || 'undefined'}`);
		return displayLabel;
	}
	
	/**
	 * Get the entire label mapping
	 */
	public getLabelMapping(): Record<string, string> {
		// Convert Map to plain object for easier serialization/logging
		const result: Record<string, string> = {};
		
		this.labelMapping.forEach((value, key) => {
			result[key] = value;
		});
		
		return result;
	}
	
	/**
	 * Clear all mappings
	 */
	public clear(): void {
		console.log("LabelManager: Clearing all label mappings");
		this.labelMapping.clear();
		this.originalToSanitizedMap.clear();
		this.sanitizedToOriginalMap.clear();
	}
	
	/**
	 * Log all mappings for debugging
	 */
	public logMappings(): void {
		console.log("LabelManager: Current display mappings:");
		
		if (this.labelMapping.size === 0) {
			console.log("  (empty)");
		} else {
			this.labelMapping.forEach((value, key) => {
				console.log(`  ${key} -> ${value}`);
			});
		}
		
		console.log("LabelManager: Current sanitization mappings:");
		if (this.originalToSanitizedMap.size === 0) {
			console.log("  (empty)");
		} else {
			this.originalToSanitizedMap.forEach((value, key) => {
				console.log(`  ${key} -> ${value}`);
			});
		}
	}
	
	/**
	 * Sanitize a label for the QSearch algorithm by replacing spaces and special characters
	 * @param originalLabel The original label to sanitize
	 * @param index Optional index to ensure uniqueness
	 * @returns The sanitized label
	 */
	public sanitizeLabel(originalLabel: string, index?: number): string {
		// Check if we already have a sanitized version
		if (this.originalToSanitizedMap.has(originalLabel)) {
			return this.originalToSanitizedMap.get(originalLabel)!;
		}
		
		// Create a sanitized version - replace spaces and problematic characters
		const indexPrefix = index !== undefined ? `L${index}_` : 'L_';
		const sanitizedLabel = `${indexPrefix}${originalLabel.replace(/[\s\n\r\t,"()[\]{}]/g, '_')}`;
		
		// Store mapping
		this.originalToSanitizedMap.set(originalLabel, sanitizedLabel);
		this.sanitizedToOriginalMap.set(sanitizedLabel, originalLabel);
		
		return sanitizedLabel;
	}
	
	/**
	 * Restore the original label from a sanitized one
	 * @param sanitizedLabel The sanitized label to restore
	 * @returns The original label or the sanitized label if not found
	 */
	public restoreOriginalLabel(sanitizedLabel: string): string {
		return this.sanitizedToOriginalMap.get(sanitizedLabel) || sanitizedLabel;
	}
	
	/**
	 * Sanitize a batch of labels for the QSearch algorithm
	 * @param labels Array of original labels
	 * @returns Array of sanitized labels in the same order
	 */
	public sanitizeLabels(labels: string[]): string[] {
		return labels.map((label, index) => this.sanitizeLabel(label, index));
	}
	
	/**
	 * Restore original labels in a tree JSON from the QSearch algorithm
	 * @param treeJSON JSON string containing tree data with sanitized labels
	 * @returns JSON string with original labels restored
	 */
	public restoreLabelsInTree(treeJSON: string): string {
		try {
			const tree = JSON.parse(treeJSON);
			
			if (tree.nodes && Array.isArray(tree.nodes)) {
				tree.nodes = tree.nodes.map((node: any) => {
					if (node.label && this.sanitizedToOriginalMap.has(node.label)) {
						return {
							...node,
							label: this.sanitizedToOriginalMap.get(node.label)
						};
					}
					return node;
				});
			}
			
			return JSON.stringify(tree);
		} catch (error) {
			console.error("LabelManager: Error restoring original labels in tree:", error);
			return treeJSON;
		}
	}
}
