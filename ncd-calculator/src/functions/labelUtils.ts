/**
 * LabelManager - Robust singleton class for managing label mapping
 * Fixes issues with special characters in imported matrices
 */
export class LabelManager {
	private static instance: LabelManager;
	
	// Single mapping from ID to display label
	private idToDisplayLabel: Map<string, string> = new Map();
	
	private constructor() {}
	
	/**
	 * Get the singleton instance
	 */
	public static getInstance(): LabelManager {
		if (!LabelManager.instance) {
			LabelManager.instance = new LabelManager();
		}
		return LabelManager.instance;
	}
	
	/**
	 * Register a mapping between an ID and its display label
	 */
	public registerLabel(id: string, displayLabel: string): void {
		if (!id) return;
		
		// Store the mapping
		this.idToDisplayLabel.set(id, displayLabel || id);
	}
	
	/**
	 * Get the display label for an ID
	 */
	public getDisplayLabel(id: string): string | undefined {
		return this.idToDisplayLabel.get(id);
	}
	
	/**
	 * Sanitize a label for use in the QSearch algorithm
	 * This replaces all invalid characters with underscores
	 */
	public sanitizeForQSearch(label: string): string {
		if (!label) return '';
		
		// First replace spaces with underscores
		let sanitized = label.replace(/\s+/g, '_');
		
		// Replace problematic symbols and punctuation with underscores
		// This preserves letters, numbers, and Unicode characters like Chinese, Japanese, etc.
		// The regex matches anything that's NOT:
		// - A letter (in any language, including CJK)
		// - A number
		// - An underscore or hyphen (common in identifiers)
		sanitized = sanitized.replace(/[^\p{L}\p{N}_\-]/gu, '_');
		
		// Replace consecutive underscores with a single one
		sanitized = sanitized.replace(/_+/g, '_');
		
		return sanitized;
		
	}
	
	/**
	 * Process tree JSON to replace tree labels with display labels
	 */
	public processTreeJSON(jsonString: string, originalLabels: string[]): string {
		try {
			const data = JSON.parse(jsonString);
			
			if (!data || !data.nodes || !Array.isArray(data.nodes)) {
				console.warn("Invalid tree JSON structure", data);
				return jsonString;
			}
			
			// Process nodes if they exist
			data.nodes = data.nodes.map((node: any) => {
				if (!node) return node;
				
				// Safety check for node.label
				if (node.label) {
					try {
						// Find the matching original label
						const matchingLabel = this.findMatchingLabel(node.label, originalLabels);
						
						if (matchingLabel) {
							// Get the display label
							const displayLabel = this.getDisplayLabel(matchingLabel);
							if (displayLabel) {
								console.log(`Replacing node label "${node.label}" with "${displayLabel}"`);
								node.label = displayLabel;
							} else {
								console.log(`No display label found for "${matchingLabel}"`);
							}
						} else {
							console.log(`No matching original label found for node label "${node.label}"`);
						}
					} catch (error) {
						console.error("Error processing node label:", error);
						// Keep the original label if there's an error
					}
				} else {
					console.warn("Node missing label property:", node);
				}
				
				return node;
			});
			
			return JSON.stringify(data);
		} catch (error) {
			console.error("Error processing tree JSON:", error);
			return jsonString;
		}
	}
	
	/**
	 * Find the original label that matches the processed label
	 * This handles cases where the QSearch algorithm might have
	 * further modified our already sanitized labels
	 */
	private findMatchingLabel(processedLabel: string, originalLabels: string[]): string | undefined {
		// Safety check for inputs
		if (!processedLabel || !originalLabels || !Array.isArray(originalLabels)) {
			console.warn("Invalid inputs to findMatchingLabel", { processedLabel, originalLabels });
			return undefined;
		}
		
		// Try direct match first
		if (originalLabels.includes(processedLabel)) {
			return processedLabel;
		}
		
		// Try matching sanitized versions
		for (const label of originalLabels) {
			if (!label) continue;
			
			// Check if sanitized version matches
			const sanitized = this.sanitizeForQSearch(label);
			if (sanitized === processedLabel) {
				return label;
			}
			
			// Also try partial matches (both ways)
			if (processedLabel.includes(sanitized) || sanitized.includes(processedLabel)) {
				return label;
			}
			
			// For labels with special characters, try an additional fallback comparison
			// by checking if the sanitized versions share significant overlap
			if (sanitized.length > 3 && processedLabel.length > 3) {
				// Calculate similarity by counting shared characters
				let matchCount = 0;
				for (let i = 0; i < Math.min(sanitized.length, processedLabel.length); i++) {
					if (sanitized[i] === processedLabel[i]) matchCount++;
				}
				
				// If more than 70% match, consider it a match
				const similarityRatio = matchCount / Math.min(sanitized.length, processedLabel.length);
				if (similarityRatio > 0.7) {
					return label;
				}
			}
		}
		
		return undefined;
	}
	
	/**
	 * Format a matrix for QSearch input, sanitizing labels
	 */
	public formatMatrixForQSearch(labels: string[], matrix: number[][]): string {
		let output = '';
		
		for (let i = 0; i < labels.length; i++) {
			// Start with the sanitized label
			const sanitizedLabel = this.sanitizeForQSearch(labels[i]);
			let line = sanitizedLabel + " ";
			
			// Add each distance value
			const row = matrix[i];
			if (Array.isArray(row)) {
				for (let j = 0; j < row.length; j++) {
					const value = typeof row[j] === 'number' && !isNaN(row[j])
						? row[j]
						: (i === j ? 0 : 0.5); // Default values
					
					line += value.toFixed(6) + " ";
				}
			}
			
			output += line.trim() + "\n";
		}
		
		return output;
	}
	
	/**
	 * Clear all mappings
	 */
	public clear(): void {
		this.idToDisplayLabel.clear();
	}
	
	/**
	 * Log all mappings for debugging
	 */
	public logMappings(): void {
		console.log("=== LabelManager Mappings ===");
		console.log("ID → Display Label:");
		console.log(Object.fromEntries(this.idToDisplayLabel));
		console.log("===========================");
	}
}
