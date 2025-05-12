import {LabelManager} from "../functions/labelUtils";

/**
 * Converts NCD matrix output to a format suitable for the QSearch algorithm,
 * with proper handling of special characters in labels using LabelManager.
 *
 * @param ncdOutput Object containing labels array and ncdMatrix 2D array
 * @returns Formatted string for QSearch algorithm input
 */
export const getTreeInput = (ncdOutput: { labels: string[], ncdMatrix: number[][] }): string => {
	const {labels, ncdMatrix} = ncdOutput;
	
	// Validate input
	if (!labels || !Array.isArray(labels) || labels.length === 0) {
		console.error("getTreeInput: Invalid or empty labels array");
		return "";
	}
	
	if (!ncdMatrix || !Array.isArray(ncdMatrix) || ncdMatrix.length === 0) {
		console.error("getTreeInput: Invalid or empty ncdMatrix");
		return "";
	}
	
	// Get LabelManager instance
	const labelManager = LabelManager.getInstance();
	
	// Create sanitized labels (to avoid issues with spaces and special characters)
	const sanitizedLabels = labels.map((label, index) =>
		labelManager.sanitizeLabel(label, index)
	);
	
	// Create the tree input string
	let treeInput = '';
	
	// For each label and its corresponding distance row
	for (let i = 0; i < sanitizedLabels.length; i++) {
		// Start with the sanitized label
		let line = sanitizedLabels[i] + " ";
		
		// Add each distance value with appropriate formatting
		const row = ncdMatrix[i];
		if (Array.isArray(row)) {
			for (let j = 0; j < row.length; j++) {
				const value = typeof row[j] === 'number' && !isNaN(row[j])
					? row[j]
					: (i === j ? 0 : 0.5); // Default values if invalid
				
				line += value.toFixed(6) + " ";
			}
		} else {
			console.error(`getTreeInput: Row ${i} is not an array`);
			// Create a default row if the actual row is invalid
			for (let j = 0; j < labels.length; j++) {
				line += (i === j ? "0.000000" : "0.500000") + " ";
			}
		}
		
		// Add the line to the tree input (removing trailing space)
		treeInput += line.trim() + "\n";
	}
	
	console.log("Generated tree input with sanitized labels via LabelManager");
	
	return treeInput;
}
