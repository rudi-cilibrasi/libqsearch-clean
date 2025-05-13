import { LabelManager } from "../functions/labelUtils";

describe('LabelManager', () => {
	let labelManager: LabelManager;
	
	beforeEach(() => {
		// Get the instance and clear it before each test
		labelManager = LabelManager.getInstance();
		labelManager.clear();
	});
	
	describe('Basic functionality', () => {
		test('should maintain a singleton instance', () => {
			const instance1 = LabelManager.getInstance();
			const instance2 = LabelManager.getInstance();
			expect(instance1).toBe(instance2);
		});
		
		test('should register and retrieve labels correctly', () => {
			labelManager.registerLabel('dq480500', 'Shetland Sheepdog');
			expect(labelManager.getDisplayLabel('dq480500')).toBe('Shetland Sheepdog');
		});
		
		test('should handle multiple registrations', () => {
			labelManager.registerLabel('dq480500', 'Shetland Sheepdog');
			labelManager.registerLabel('dq480501', 'Swedish Elkhound');
			labelManager.registerLabel('dq480502', 'Jamthund');
			
			expect(labelManager.getDisplayLabel('dq480500')).toBe('Shetland Sheepdog');
			expect(labelManager.getDisplayLabel('dq480501')).toBe('Swedish Elkhound');
			expect(labelManager.getDisplayLabel('dq480502')).toBe('Jamthund');
		});
		
		test('should correctly clear all mappings', () => {
			labelManager.registerLabel('dq480500', 'Shetland Sheepdog');
			expect(labelManager.getDisplayLabel('dq480500')).toBe('Shetland Sheepdog');
			
			labelManager.clear();
			expect(labelManager.getDisplayLabel('dq480500')).toBeUndefined();
		});
	});
	
	describe('Label sanitization', () => {
		test('should sanitize labels by replacing spaces with underscores', () => {
			const original = 'Shetland Sheepdog';
			const sanitized = labelManager.sanitizeForQSearch(original);
			expect(sanitized).toBe('Shetland_Sheepdog');
		});
		
		test('should sanitize problematic characters while preserving non-Latin characters', () => {
			// Replace problematic characters with underscores
			expect(labelManager.sanitizeForQSearch('Label (with) [brackets]')).toBe('Label_with_brackets_');
			expect(labelManager.sanitizeForQSearch('Label "with", commas')).toBe('Label_with_commas');
			
			// But preserve Unicode characters like Chinese, Japanese, etc.
			expect(labelManager.sanitizeForQSearch('Sushi (飽司)')).toBe('Sushi_飽司_');
			expect(labelManager.sanitizeForQSearch('北京市')).toBe('北京市');
			expect(labelManager.sanitizeForQSearch('東京 (Tokyo)')).toBe('東京_Tokyo_');
			
			// Handle mixed cases
			expect(labelManager.sanitizeForQSearch('Paella & Valenciana')).toBe('Paella_Valenciana');
			expect(labelManager.sanitizeForQSearch('München, Germany')).toBe('München_Germany');
		});
		
		test('should convert consecutive special characters to a single underscore', () => {
			expect(labelManager.sanitizeForQSearch('Hello,,,World')).toBe('Hello_World');
			expect(labelManager.sanitizeForQSearch('Test---Dash')).toBe('Test---Dash');
			expect(labelManager.sanitizeForQSearch('Multiple   Spaces')).toBe('Multiple_Spaces');
		});
		
		test('should handle empty and undefined inputs in sanitization', () => {
			expect(labelManager.sanitizeForQSearch('')).toBe('');
			// @ts-ignore - Testing with undefined
			expect(labelManager.sanitizeForQSearch(undefined)).toBe('');
			// @ts-ignore - Testing with null
			expect(labelManager.sanitizeForQSearch(null)).toBe('');
		});
	});
	
	describe('Matrix formatting', () => {
		test('should format matrices correctly for QSearch input', () => {
			const labels = ['Dog', 'Cat with spaces', 'Fish (underwater)'];
			const matrix = [
				[0, 0.5, 0.7],
				[0.5, 0, 0.6],
				[0.7, 0.6, 0]
			];
			
			const formatted = labelManager.formatMatrixForQSearch(labels, matrix);
			const lines = formatted.trim().split('\n');
			
			expect(lines.length).toBe(3);
			expect(lines[0]).toContain('Dog');
			expect(lines[1]).toContain('Cat_with_spaces');
			expect(lines[2]).toContain('Fish_underwater');
			
			// Check that matrix values are included
			expect(lines[0]).toMatch(/Dog 0\.000000 0\.500000 0\.700000/);
		});
		
		test('should preserve non-Latin characters when formatting matrices', () => {
			const labels = ['Sushi (飽司)', '北京市', 'Cat'];
			const matrix = [
				[0, 0.5, 0.7],
				[0.5, 0, 0.6],
				[0.7, 0.6, 0]
			];
			
			const formatted = labelManager.formatMatrixForQSearch(labels, matrix);
			const lines = formatted.trim().split('\n');
			
			expect(lines.length).toBe(3);
			expect(lines[0]).toContain('Sushi_飽司');
			expect(lines[1]).toContain('北京市');
			expect(lines[2]).toContain('Cat');
		});
		
		test('should handle invalid matrices gracefully', () => {
			const labels = ['Dog', 'Cat'];
			const invalidMatrix = [
				[0, 0.5],
				// Missing row
			];
			
			// @ts-ignore - Intentionally passing invalid matrix
			const formatted = labelManager.formatMatrixForQSearch(labels, invalidMatrix);
			const lines = formatted.trim().split('\n');
			
			expect(lines.length).toBe(2);
			expect(lines[0]).toContain('Dog');
			expect(lines[1]).toContain('Cat');
		});
	});
	
	describe('Tree JSON processing', () => {
		test('should process tree JSON to replace labels', () => {
			// Register some labels
			labelManager.registerLabel('dog', 'Dog');
			labelManager.registerLabel('cat', 'Cat');
			
			// Create a mock tree JSON
			const treeJSON = JSON.stringify({
				nodes: [
					{ id: 0, label: 'dog', x: 1, y: 2, z: 3 },
					{ id: 1, label: 'cat', x: 4, y: 5, z: 6 }
				],
				edges: [{ source: 0, target: 1 }]
			});
			
			const processedJSON = labelManager.processTreeJSON(treeJSON, ['dog', 'cat']);
			const processed = JSON.parse(processedJSON);
			
			expect(processed.nodes[0].label).toBe('Dog');
			expect(processed.nodes[1].label).toBe('Cat');
		});
		
		test('should handle sanitized labels in tree JSON', () => {
			// Register some labels with spaces and special characters
			labelManager.registerLabel('New York City', 'New York City');
			labelManager.registerLabel('Paris, France', 'Paris, France');
			
			// Create a mock tree JSON with sanitized labels
			const treeJSON = JSON.stringify({
				nodes: [
					{ id: 0, label: 'New_York_City', x: 1, y: 2, z: 3 },
					{ id: 1, label: 'Paris_France', x: 4, y: 5, z: 6 }
				],
				edges: [{ source: 0, target: 1 }]
			});
			
			const processedJSON = labelManager.processTreeJSON(treeJSON, ['New York City', 'Paris, France']);
			const processed = JSON.parse(processedJSON);
			
			expect(processed.nodes[0].label).toBe('New York City');
			expect(processed.nodes[1].label).toBe('Paris, France');
		});
		
		test('should handle labels with non-Latin characters', () => {
			// Register labels with Unicode characters
			const labels = [
				'Sushi (飽司)',
				'北京市 (Beijing)',
				'München, Germany'
			];
			
			labels.forEach(label => {
				labelManager.registerLabel(label, label);
			});
			
			// Create tree JSON with sanitized versions of these labels
			const treeJSON = JSON.stringify({
				nodes: [
					{ id: 0, label: 'Sushi_飽司', x: 1, y: 2, z: 3 },
					{ id: 1, label: '北京市_Beijing', x: 4, y: 5, z: 6 },
					{ id: 2, label: 'München_Germany', x: 7, y: 8, z: 9 }
				],
				edges: []
			});
			
			const processedJSON = labelManager.processTreeJSON(treeJSON, labels);
			const processed = JSON.parse(processedJSON);
			
			expect(processed.nodes[0].label).toBe('Sushi (飽司)');
			expect(processed.nodes[1].label).toBe('北京市 (Beijing)');
			expect(processed.nodes[2].label).toBe('München, Germany');
		});
		
		test('should match labels using multiple strategies', () => {
			// Register original labels
			const originalLabels = [
				'Blue Whale (Balaenoptera musculus)',
				'Sushi (飽司)',
				'ChatGPT [OpenAI]'
			];
			
			originalLabels.forEach(label => {
				labelManager.registerLabel(label, label);
			});
			
			// Create tree JSON with various transformations of the labels
			const treeJSON = JSON.stringify({
				nodes: [
					{ id: 0, label: 'Blue_Whale_Balaenoptera_musculus', x: 1, y: 2, z: 3 },
					{ id: 1, label: 'Sushi_飽司', x: 4, y: 5, z: 6 },
					{ id: 2, label: 'ChatGPT_OpenAI', x: 7, y: 8, z: 9 }
				],
				edges: []
			});
			
			const processedJSON = labelManager.processTreeJSON(treeJSON, originalLabels);
			const processed = JSON.parse(processedJSON);
			
			expect(processed.nodes[0].label).toBe('Blue Whale (Balaenoptera musculus)');
			expect(processed.nodes[1].label).toBe('Sushi (飽司)');
			expect(processed.nodes[2].label).toBe('ChatGPT [OpenAI]');
		});
		
		test('should handle invalid tree JSON gracefully', () => {
			const invalidJSON = '{invalid json}';
			const result = labelManager.processTreeJSON(invalidJSON, ['label1', 'label2']);
			
			// Should return the original string when invalid
			expect(result).toBe(invalidJSON);
		});
		
		test('should handle missing or invalid nodes in tree JSON', () => {
			const invalidNodesJSON = JSON.stringify({
				// Missing nodes array
				edges: [{ source: 0, target: 1 }]
			});
			
			const result = labelManager.processTreeJSON(invalidNodesJSON, ['label1', 'label2']);
			
			// Should return the original string when invalid
			expect(result).toBe(invalidNodesJSON);
		});
		
		test('should handle nodes without labels', () => {
			const noLabelsJSON = JSON.stringify({
				nodes: [
					{ id: 0, x: 1, y: 2, z: 3 }, // No label property
					{ id: 1, x: 4, y: 5, z: 6 }
				],
				edges: [{ source: 0, target: 1 }]
			});
			
			const result = labelManager.processTreeJSON(noLabelsJSON, ['label1', 'label2']);
			const processed = JSON.parse(result);
			
			// Should preserve the original nodes
			expect(processed.nodes[0].id).toBe(0);
			expect(processed.nodes[1].id).toBe(1);
			expect(processed.nodes[0].label).toBeUndefined();
		});
	});
	
	describe('Finding matching labels', () => {
		// We need to test the private findMatchingLabel method
		// Let's use a workaround to access it
		
		test('should find direct matches', () => {
			const labels = ['dog', 'cat', 'fish'];
			// @ts-ignore - Accessing private method
			const result = labelManager['findMatchingLabel']('dog', labels);
			expect(result).toBe('dog');
		});
		
		test('should match sanitized labels', () => {
			const labels = ['New York City', 'Paris, France'];
			
			// @ts-ignore - Accessing private method
			const result1 = labelManager['findMatchingLabel']('New_York_City', labels);
			expect(result1).toBe('New York City');
			
			// @ts-ignore - Accessing private method
			const result2 = labelManager['findMatchingLabel']('Paris_France', labels);
			expect(result2).toBe('Paris, France');
		});
		
		test('should match labels with non-Latin characters', () => {
			const labels = ['Sushi (飽司)', '北京市', '東京 (Tokyo)'];
			
			// @ts-ignore - Accessing private method
			const result1 = labelManager['findMatchingLabel']('Sushi_飽司', labels);
			expect(result1).toBe('Sushi (飽司)');
			
			// @ts-ignore - Accessing private method
			const result2 = labelManager['findMatchingLabel']('北京市', labels);
			expect(result2).toBe('北京市');
			
			// @ts-ignore - Accessing private method
			const result3 = labelManager['findMatchingLabel']('東京_Tokyo', labels);
			expect(result3).toBe('東京 (Tokyo)');
		});
		
		test('should handle partial matches', () => {
			const labels = ['Blue Whale (Balaenoptera musculus)', 'iPhone 14 Pro'];
			
			// @ts-ignore - Accessing private method
			const result1 = labelManager['findMatchingLabel']('Blue_Whale', labels);
			expect(result1).toBe('Blue Whale (Balaenoptera musculus)');
			
			// @ts-ignore - Accessing private method
			const result2 = labelManager['findMatchingLabel']('iPhone_14', labels);
			expect(result2).toBe('iPhone 14 Pro');
		});
		
		test('should handle similar but not identical matches using character similarity', () => {
			const labels = ['Quantum Computing', 'Quantum Physics'];
			
			// Slightly different sanitized version
			// @ts-ignore - Accessing private method
			const result = labelManager['findMatchingLabel']('Quantum_Comp', labels);
			expect(result).toBe('Quantum Computing');
		});
		
		test('should handle empty or invalid inputs', () => {
			const labels = ['dog', 'cat', 'fish'];
			
			// @ts-ignore - Accessing private method
			expect(labelManager['findMatchingLabel']('', labels)).toBeUndefined();
			// @ts-ignore - Accessing private method with null
			expect(labelManager['findMatchingLabel'](null, labels)).toBeUndefined();
			// @ts-ignore - Accessing private method with undefined array
			expect(labelManager['findMatchingLabel']('dog', undefined)).toBeUndefined();
			// @ts-ignore - Accessing private method with non-array
			expect(labelManager['findMatchingLabel']('dog', 'not an array')).toBeUndefined();
		});
	});
	
	describe('Integration scenarios', () => {
		test('should handle the complete workflow for normal operation with accession IDs', () => {
			// 1. Register labels
			labelManager.registerLabel('dq480500', 'Shetland Sheepdog');
			labelManager.registerLabel('dq480501', 'Swedish Elkhound');
			
			// 2. Create a matrix
			const labels = ['dq480500', 'dq480501'];
			const matrix = [
				[0, 0.5],
				[0.5, 0]
			];
			
			// 3. Format for QSearch
			const formatted = labelManager.formatMatrixForQSearch(labels, matrix);
			expect(formatted).toContain('dq480500');
			expect(formatted).toContain('dq480501');
			
			// 4. Process the tree result
			const treeJSON = JSON.stringify({
				nodes: [
					{ id: 0, label: 'dq480500', x: 1, y: 2, z: 3 },
					{ id: 1, label: 'dq480501', x: 4, y: 5, z: 6 }
				],
				edges: [{ source: 0, target: 1 }]
			});
			
			const processedJSON = labelManager.processTreeJSON(treeJSON, labels);
			const processed = JSON.parse(processedJSON);
			
			// 5. Check that display labels are used in the result
			expect(processed.nodes[0].label).toBe('Shetland Sheepdog');
			expect(processed.nodes[1].label).toBe('Swedish Elkhound');
		});
		
		test('should handle the complete workflow for imported matrices with special characters', () => {
			// 1. Define imported matrix labels
			const importedLabels = [
				'Paris, France',
				'New York City',
				'Blue Whale (Balaenoptera musculus)'
			];
			
			// 2. Register labels (for imported matrices, ID = display label)
			importedLabels.forEach(label => {
				labelManager.registerLabel(label, label);
			});
			
			// 3. Create a matrix
			const matrix = [
				[0, 0.5, 0.7],
				[0.5, 0, 0.6],
				[0.7, 0.6, 0]
			];
			
			// 4. Format for QSearch
			const formatted = labelManager.formatMatrixForQSearch(importedLabels, matrix);
			expect(formatted).toContain('Paris_France');
			expect(formatted).toContain('New_York_City');
			expect(formatted).toContain('Blue_Whale_Balaenoptera_musculus');
			
			// 5. Process the tree result
			const treeJSON = JSON.stringify({
				nodes: [
					{ id: 0, label: 'Paris_France', x: 1, y: 2, z: 3 },
					{ id: 1, label: 'New_York_City', x: 4, y: 5, z: 6 },
					{ id: 2, label: 'Blue_Whale_Balaenoptera_musculus', x: 7, y: 8, z: 9 }
				],
				edges: [
					{ source: 0, target: 1 },
					{ source: 1, target: 2 }
				]
			});
			
			const processedJSON = labelManager.processTreeJSON(treeJSON, importedLabels);
			const processed = JSON.parse(processedJSON);
			
			// 6. Check that original labels are used in the result
			expect(processed.nodes[0].label).toBe('Paris, France');
			expect(processed.nodes[1].label).toBe('New York City');
			expect(processed.nodes[2].label).toBe('Blue Whale (Balaenoptera musculus)');
		});
		
		test('should handle the complete workflow for imported matrices with non-Latin characters', () => {
			// 1. Define imported matrix labels with non-Latin characters
			const importedLabels = [
				'Sushi (飽司)',
				'北京市 (Beijing)',
				'東京 (Tokyo)'
			];
			
			// 2. Register labels (for imported matrices, ID = display label)
			importedLabels.forEach(label => {
				labelManager.registerLabel(label, label);
			});
			
			// 3. Create a matrix
			const matrix = [
				[0, 0.5, 0.7],
				[0.5, 0, 0.6],
				[0.7, 0.6, 0]
			];
			
			// 4. Format for QSearch
			const formatted = labelManager.formatMatrixForQSearch(importedLabels, matrix);
			expect(formatted).toContain('Sushi_飽司');
			expect(formatted).toContain('北京市_Beijing');
			expect(formatted).toContain('東京_Tokyo');
			
			// 5. Process the tree result
			const treeJSON = JSON.stringify({
				nodes: [
					{ id: 0, label: 'Sushi_飽司', x: 1, y: 2, z: 3 },
					{ id: 1, label: '北京市_Beijing', x: 4, y: 5, z: 6 },
					{ id: 2, label: '東京_Tokyo', x: 7, y: 8, z: 9 }
				],
				edges: [
					{ source: 0, target: 1 },
					{ source: 1, target: 2 }
				]
			});
			
			const processedJSON = labelManager.processTreeJSON(treeJSON, importedLabels);
			const processed = JSON.parse(processedJSON);
			
			// 6. Check that original labels with non-Latin characters are used in the result
			expect(processed.nodes[0].label).toBe('Sushi (飽司)');
			expect(processed.nodes[1].label).toBe('北京市 (Beijing)');
			expect(processed.nodes[2].label).toBe('東京 (Tokyo)');
		});
	});
});
