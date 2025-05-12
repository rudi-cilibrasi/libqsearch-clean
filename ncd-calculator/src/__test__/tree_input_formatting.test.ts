import {getTreeInput} from "@/functions/qtree.ts";
import {LabelManager} from "@/functions/labelUtils.ts";

describe('Tree Input Formatting', () => {
	let labelManager: LabelManager;
	
	beforeEach(() => {
		// Reset LabelManager before each test
		labelManager = LabelManager.getInstance();
		labelManager.clear();
	});
	
	test('should format matrix data correctly for QSearch algorithm', () => {
		const labels = ['Label A', 'Label B', 'Label C', 'Label D'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5, 0.7],
			[0.3, 0.0, 0.4, 0.6],
			[0.5, 0.4, 0.0, 0.2],
			[0.7, 0.6, 0.2, 0.0]
		];
		
		const formattedInput = getTreeInput({labels, ncdMatrix});
		
		// Check basic format structure
		expect(formattedInput).toContain('4'); // Number of labels
		
		// Check that sanitized labels are included
		const sanitizedLabels = labelManager.sanitizeLabels(labels);
		sanitizedLabels.forEach(label => {
			expect(formattedInput).toContain(label);
		});
		
		// Check that all matrix values are present
		expect(formattedInput).toContain('0.000000 0.300000 0.500000 0.700000');
		expect(formattedInput).toContain('0.300000 0.000000 0.400000 0.600000');
		expect(formattedInput).toContain('0.500000 0.400000 0.000000 0.200000');
		expect(formattedInput).toContain('0.700000 0.600000 0.200000 0.000000');
	});
	
	test('should handle unicode characters in labels', () => {
		const labels = ['Label 🔬', 'Label 🧬', 'Label 👨‍🔬', 'Label 🧪'];
		const ncdMatrix = [
			[0.0, 0.3, 0.5, 0.7],
			[0.3, 0.0, 0.4, 0.6],
			[0.5, 0.4, 0.0, 0.2],
			[0.7, 0.6, 0.2, 0.0]
		];
		
		const formattedInput = getTreeInput({labels, ncdMatrix});
		
		// Check that sanitized labels are included with unicode handled correctly
		const sanitizedLabels = labelManager.sanitizeLabels(labels);
		sanitizedLabels.forEach(label => {
			expect(formattedInput).toContain(label);
		});
		
		// Check that all matrix values are present
		expect(formattedInput).toContain('0.000000 0.300000 0.500000 0.700000');
	});
	
	test('should round matrix values to preserve precision', () => {
		const labels = ['A', 'B', 'C', 'D'];
		const ncdMatrix = [
			[0.0, 0.333333333, 0.5, 0.7],
			[0.333333333, 0.0, 0.4, 0.6],
			[0.5, 0.4, 0.0, 0.2],
			[0.7, 0.6, 0.2, 0.0]
		];
		
		const formattedInput = getTreeInput({labels, ncdMatrix});
		
		// Check for rounded values
		expect(formattedInput).toContain('0.000000 0.333333 0.500000 0.700000');
		expect(formattedInput).not.toContain('0.333333333');
	});
});
