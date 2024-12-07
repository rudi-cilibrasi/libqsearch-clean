import graphlib from 'graphlib';
import dot from 'graphlib-dot';

interface Node {
    index: number;
    label?: string;
    connections: number[];
}

interface Nodes {
    nodes: Node[];
}

function createGraph(nodes: Nodes, directed: boolean): string {
    const g = new graphlib.Graph({ directed: directed });
    nodes.nodes.forEach((node) => {
        g.setNode(node.index, { label: node.label === undefined ? "" : node.label });

        node.connections.forEach((childIndex) => {
            g.setEdge(node.index, childIndex);
        });
    });

    return dot.write(g);
}

export default createGraph;
