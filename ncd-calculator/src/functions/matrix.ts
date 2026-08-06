export function validateMatrix(labels: string[], ncdMatrix: number[][]): string | null {
	if (!labels || !Array.isArray(labels) || labels.length === 0) {
		return "Invalid or empty labels array";
	}
	
	if (!ncdMatrix || !Array.isArray(ncdMatrix) || ncdMatrix.length === 0) {
		return "Invalid or empty ncdMatrix";
	}

	if (labels.some((label) => typeof label !== "string" || label.trim() === "")) {
		return "Labels must be non-empty strings";
	}
	if (new Set(labels.map((label) => label.trim())).size !== labels.length) {
		return "Labels must be unique";
	}
	
	if (ncdMatrix.length !== labels.length) {
		return `Matrix dimensions mismatch: ${ncdMatrix.length} rows vs ${labels.length} labels`;
	}
	
	for (let i = 0; i < ncdMatrix.length; i++) {
		if (!Array.isArray(ncdMatrix[i])) {
			return `Row ${i} is not an array`;
		}
		
		if (ncdMatrix[i].length !== labels.length) {
			return `Row ${i} has ${ncdMatrix[i].length} columns, expected ${labels.length}`;
		}
		
		for (let j = 0; j < ncdMatrix[i].length; j++) {
			if (typeof ncdMatrix[i][j] !== 'number' || !Number.isFinite(ncdMatrix[i][j])) {
				return `Invalid value at [${i}][${j}]: ${ncdMatrix[i][j]}`;
			}
			if (ncdMatrix[i][j] < 0) {
				return `Negative distance at [${i}][${j}]: ${ncdMatrix[i][j]}`;
			}
		}
	}

	const tolerance = 1e-9;
	for (let i = 0; i < ncdMatrix.length; i++) {
		if (Math.abs(ncdMatrix[i][i]) > tolerance) {
			return `Diagonal value at [${i}][${i}] must be zero`;
		}
		for (let j = i + 1; j < ncdMatrix.length; j++) {
			if (Math.abs(ncdMatrix[i][j] - ncdMatrix[j][i]) > tolerance) {
				return `Matrix must be symmetric at [${i}][${j}] and [${j}][${i}]`;
			}
		}
	}
	
	return null; // Matrix is valid
}
