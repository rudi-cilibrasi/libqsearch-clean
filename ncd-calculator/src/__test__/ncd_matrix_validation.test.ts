import {validateMatrix} from "@/functions/matrix.ts";

describe('Matrix Validation', () => {
	test('should validate the valid matrix', () => {
		const labels = ['A', 'B', 'C', 'D'];
		const distances: number[][] = [
			[0.0, 0.3, 0.5, 0.7],
			[0.3, 0.0, 0.4, 0.6],
			[0.5, 0.4, 0.0, 0.2],
			[0.7, 0.6, 0.2, 0.0]
		];
		expect(validateMatrix(labels, distances)).toBe(null);
	})
	
	test('should reject empty labels', () => {
		expect(validateMatrix([], [[0]])).toContain("Invalid or empty labels array");
	})
	
	
	test('should reject empty matrix', () => {
		expect(validateMatrix(['A'], [])).toContain('Invalid or empty ncdMatrix');
	});
	
	test('should reject matrix with row count not matching label count', () => {
		const labels = ['A', 'B', 'C'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5],
			[0.3, 0.0, 0.4]
		];
		
		expect(validateMatrix(labels, ncdMatrix)).toContain('Matrix dimensions mismatch');
	});
	
	test('should reject matrix with column count not matching label count', () => {
		const labels = ['A', 'B', 'C'];
		const ncdMatrix = [
			[0.0, 0.3],
			[0.3, 0.0],
			[0.5, 0.4]
		];
		
		expect(validateMatrix(labels, ncdMatrix)).toContain('has 2 columns, expected 3');
	});
	
	test('should reject matrix with invalid numerical values', () => {
		const labels = ['A', 'B'];
		const ncdMatrix = [
			[0.0, 'invalid'],
			[0.3, 0.0]
		];
		
		expect(validateMatrix(labels, ncdMatrix)).toContain('Invalid value at');
	});
	
	test('should reject matrix with NaN values', () => {
		const labels = ['A', 'B'];
		const ncdMatrix = [
			[0.0, NaN],
			[0.3, 0.0]
		];
		
		expect(validateMatrix(labels, ncdMatrix)).toContain('Invalid value at');
	});
})
