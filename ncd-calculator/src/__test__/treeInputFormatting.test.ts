import { getTreeInput } from "@/functions/qtree.ts";
import { LabelManager } from "@/functions/labelUtils.ts";

describe('Tree Input Formatting', () => {
	let labelManager: LabelManager;
	let formatMatrixSpy: jest.SpyInstance;
	
	
	beforeEach(() => {
		// Get the LabelManager singleton instance
		labelManager = LabelManager.getInstance();
		
		// Clear any previous mappings
		labelManager.clear();
		
		// Mock the formatMatrixForQSearch method to test that it's called correctly
		formatMatrixSpy = jest.spyOn(labelManager, 'formatMatrixForQSearch');
	});
	
	afterEach(() => {
		// Ensure all mocks are properly restored
		formatMatrixSpy.mockRestore();
		jest.clearAllMocks();
		jest.resetAllMocks();
		
		// Clear any registered labels to avoid state leakage
		labelManager.clear();
	});
	
	// Properly cleanup after all tests are done
	afterAll(() => {
		jest.restoreAllMocks();
	});
	
	test('should call LabelManager.formatMatrixForQSearch with correct parameters', () => {
		// Arrange
		const labels = ['Label A', 'Label B', 'Label C', 'Label D'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5, 0.7],
			[0.3, 0.0, 0.4, 0.6],
			[0.5, 0.4, 0.0, 0.2],
			[0.7, 0.6, 0.2, 0.0]
		];
		
		// Mock return value
		const mockFormattedMatrix = "4\nLabel_A 0.000000 0.300000 0.500000 0.700000\n...";
		jest.spyOn(labelManager, 'formatMatrixForQSearch').mockReturnValue(mockFormattedMatrix);
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		expect(labelManager.formatMatrixForQSearch).toHaveBeenCalledWith(labels, ncdMatrix);
		expect(result).toBe(mockFormattedMatrix);
	});
	
	test('should return empty string if labels array is empty', () => {
		// Arrange
		const labels: string[] = [];
		const ncdMatrix = [[0]];
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		expect(result).toBe("");
		expect(labelManager.formatMatrixForQSearch).not.toHaveBeenCalled();
	});
	
	test('should return empty string if ncdMatrix is empty', () => {
		// Arrange
		const labels = ['Label A', 'Label B'];
		const ncdMatrix: number[][] = [];
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		expect(result).toBe("");
		expect(labelManager.formatMatrixForQSearch).not.toHaveBeenCalled();
	});
	
	test('should handle sanitization correctly through LabelManager', () => {
		// We'll test the actual implementation without mocking
		jest.restoreAllMocks();
		
		// Arrange
		const labels = ['Label A', 'Label.With.Dots', 'Label/With/Slashes'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5],
			[0.3, 0.0, 0.4],
			[0.5, 0.4, 0.0]
		];
		
		// Register the labels with the LabelManager
		labels.forEach(label => {
			labelManager.registerLabel(label, label);
		});
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		// Check that each label is sanitized according to LabelManager's rules
		expect(result).toContain('Label_A');
		expect(result).toContain('Label_With_Dots');
		expect(result).toContain('Label_With_Slashes');
		
		// Check that matrix values are present and properly formatted
		expect(result).toContain('0.000000 0.300000 0.500000');
		expect(result).toContain('0.300000 0.000000 0.400000');
		expect(result).toContain('0.500000 0.400000 0.000000');
	});
	
	test('should handle rounding for matrix values', () => {
		// Restore original implementation
		jest.restoreAllMocks();
		
		// Arrange
		const labels = ['A', 'B', 'C'];
		const ncdMatrix = [
			[0.0, 0.333333333, 0.5],
			[0.333333333, 0.0, 0.4],
			[0.5, 0.4, 0.0]
		];
		
		// Register the labels
		labels.forEach(label => {
			labelManager.registerLabel(label, label);
		});
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		// Check that values are rounded to 6 decimal places
		expect(result).toContain('0.000000 0.333333 0.500000');
		expect(result).toContain('0.333333 0.000000 0.400000');
		expect(result).toContain('0.500000 0.400000 0.000000');
		
		// Make sure the original long decimal is not present
		expect(result).not.toContain('0.333333333');
	});
	
	test('should handle unicode characters and emojis correctly', () => {
		// Restore original implementation
		jest.restoreAllMocks();
		
		// Arrange
		const labels = ['Label 🔬', 'Label 🧬', 'Label 👨‍🔬'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5],
			[0.3, 0.0, 0.4],
			[0.5, 0.4, 0.0]
		];
		
		// Register the labels
		labels.forEach(label => {
			labelManager.registerLabel(label, label);
		});
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		// Check that each label is sanitized correctly according to LabelManager's rules
		labels.forEach(label => {
			const sanitized = labelManager.sanitizeForQSearch(label);
			expect(result).toContain(sanitized);
		});
	});
	
	test('should preserve hyphens and underscores in labels', () => {
		// Restore original implementation
		jest.restoreAllMocks();
		
		// Arrange
		const labels = ['Label-With-Hyphens', 'Label_With_Underscores', 'Mixed-Label_With_Both'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5],
			[0.3, 0.0, 0.4],
			[0.5, 0.4, 0.0]
		];
		
		// Register the labels
		labels.forEach(label => {
			labelManager.registerLabel(label, label);
		});
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		// Check that hyphens and underscores are preserved in the output
		expect(result).toContain('Label-With-Hyphens');
		expect(result).toContain('Label_With_Underscores');
		expect(result).toContain('Mixed-Label_With_Both');
	});
	
	test('should collapse consecutive special characters to a single underscore', () => {
		// Restore original implementation
		jest.restoreAllMocks();
		
		// Arrange
		const labels = ['Label...With...Dots', 'Label///With///Slashes', 'Label   With   Spaces'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5],
			[0.3, 0.0, 0.4],
			[0.5, 0.4, 0.0]
		];
		
		// Register the labels
		labels.forEach(label => {
			labelManager.registerLabel(label, label);
		});
		
		// Act
		const result = getTreeInput({ labels, ncdMatrix });
		
		// Assert
		// Check that consecutive special characters are collapsed to a single underscore
		expect(result).toContain('Label_With_Dots');
		expect(result).toContain('Label_With_Slashes');
		expect(result).toContain('Label_With_Spaces');
	});
	
	test('should handle null or undefined values in the matrix', () => {
		// Restore original implementation
		jest.restoreAllMocks();
		
		// Spy on the formatMatrixForQSearch to verify it handles null/undefined
		jest.spyOn(labelManager, 'formatMatrixForQSearch');
		
		// Arrange
		const labels = ['A', 'B', 'C'];
		// @ts-ignore - Deliberately creating a matrix with problematic values for testing
		const ncdMatrix = [
			[0.0, 0.3, null],
			[0.3, 0.0, undefined],
			[null, undefined, 0.0]
		];
		
		// Act
		getTreeInput({ labels, ncdMatrix });
		
		expect(labelManager.formatMatrixForQSearch).toHaveBeenCalledWith(labels, ncdMatrix);
	});
});
