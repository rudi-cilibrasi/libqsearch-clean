import {LabelManager} from "@/functions/labelUtils.ts";

describe('Label Manager', () => {
	let labelManager: LabelManager;
	beforeEach(() => {
		labelManager = LabelManager.getInstance();
		labelManager.clear();
	})
	
	test('should properly register and retrieve labels', () => {
		labelManager.registerLabel('id1', 'Display Label 1');
		expect(labelManager.getDisplayLabel('id1')).toBe('Display Label 1');
	})
	
	
	test('should handle empty or undefined inputs gracefully', () => {
		labelManager.registerLabel('', 'Empty ID');
		expect(labelManager.getDisplayLabel('')).toBeUndefined();
		
		labelManager.registerLabel(undefined, 'Undefined ID');
		expect(labelManager.getDisplayLabel(undefined)).toBeUndefined();
	})
	
	
	test('should sanitize labels with special characters', () => {
		// Space characters
		expect(labelManager.sanitizeLabel('Label with spaces')).toBe('L_Label_with_spaces');
		
		// Parentheses and brackets
		expect(labelManager.sanitizeLabel('Label (with) [brackets]')).toBe('L_Label__with___brackets_');
		
		// Quotes and commas
		expect(labelManager.sanitizeLabel('Label "with", commas')).toBe('L_Label__with___commas');
		
		// Mixed special characters
		expect(labelManager.sanitizeLabel('Complex [Label] (with) "many" chars')).toBe('L_Complex__Label___with___many__chars');
	});
	
	
	test('should restore original labels correctly', () => {
		const originalLabel = 'Complex [Label] (with) "many" chars';
		const sanitizedLabel = labelManager.sanitizeLabel(originalLabel);
		expect(labelManager.restoreOriginalLabel(sanitizedLabel)).toBe(originalLabel);
	});
	
	
	test('should handle index-based sanitization', () => {
		const originalLabel = 'Same Label';
		const sanitizedLabel1 = labelManager.sanitizeLabel(originalLabel, 0);
		const sanitizedLabel2 = labelManager.sanitizeLabel(originalLabel, 1);
		
		expect(sanitizedLabel1).toBe('L0_Same_Label');
		expect(sanitizedLabel2).toBe('L1_Same_Label');
		expect(sanitizedLabel1).not.toBe(sanitizedLabel2);
	});
	
	test('should restore tree JSON with sanitized labels', () => {
		// Setup initial mappings
		const originalLabels = ['Label with spaces', 'Label (with) [brackets]'];
		const sanitizedLabels = labelManager.sanitizeLabels(originalLabels);
		
		// Create a mock tree JSON with sanitized labels
		const mockTree = {
			nodes: [
				{id: 0, label: sanitizedLabels[0], x: 1, y: 2, z: 3},
				{id: 1, label: sanitizedLabels[1], x: 4, y: 5, z: 6}
			],
			edges: [{source: 0, target: 1}]
		};
		
		const restoredTreeJSON = labelManager.restoreLabelsInTree(JSON.stringify(mockTree));
		const restoredTree = JSON.parse(restoredTreeJSON);
		
		expect(restoredTree.nodes[0].label).toBe(originalLabels[0]);
		expect(restoredTree.nodes[1].label).toBe(originalLabels[1]);
	});
})
