import React from 'react'
import createGraph from '../functions/graphExport.ts';

describe('Graph DOT File Generation', () => {
    it('should generate a DOT file for a simple directed graph', () => {
        const graphNodes = {nodes: [
            { connections: [2, 3], index: 1, label: "undefined" }, // Parent node
            { connections: [], index: 2, label: "Russian" }, // Leaf node
            { connections: [], index: 3, label: "English" }, // Leaf node
        ]};

        const expectedDot = "strict digraph {\n" +
            "  \"1\" [label=undefined]\n" +
            "  \"2\" [label=Russian]\n" +
            "  \"3\" [label=English]\n" +
            "  \"1\" -> \"2\"\n" +
            "  \"1\" -> \"3\"\n" +
            "}"

        const result = createGraph(graphNodes, true);
        expect(result.trim()).toBe(expectedDot);
    });
});
