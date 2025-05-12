export function validateMatrix(labels: string[], ncdMatrix: number[][]): string | null {
	if (!labels || !Array.isArray(labels) || labels.length === 0) {
		return "Invalid or empty labels array";
	}
	
	if (!ncdMatrix || !Array.isArray(ncdMatrix) || ncdMatrix.length === 0) {
		return "Invalid or empty ncdMatrix";
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
			if (typeof ncdMatrix[i][j] !== 'number' || isNaN(ncdMatrix[i][j])) {
				return `Invalid value at [${i}][${j}]: ${ncdMatrix[i][j]}`;
			}
		}
	}
	
	return null; // Matrix is valid
}
