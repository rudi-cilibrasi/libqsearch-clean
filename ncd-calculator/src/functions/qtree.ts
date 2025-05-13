import {LabelManager} from "@/functions/labelUtils.ts";

/**
 * Converts NCD matrix output to a format suitable for the QSearch algorithm,
 * with proper handling of special characters in labels using the simplified LabelManager.
 *
 * @param ncdOutput Object containing labels array and ncdMatrix 2D array
 * @returns Formatted string for QSearch algorithm input
 */
export const getTreeInput = (ncdOutput: { labels: string[], ncdMatrix: number[][] }): string => {
	const { labels, ncdMatrix } = ncdOutput;
	
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
	
	// Use the formatMatrixForQSearch method from our simplified LabelManager
	return labelManager.formatMatrixForQSearch(labels, ncdMatrix);
};
