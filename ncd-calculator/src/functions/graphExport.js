import graphlib from 'graphlib';
import dot from 'graphlib-dot';

function createGraph(nodes, directed) {
    const g = new graphlib.Graph({ directed: directed });
    console.log("createGraph nodes", nodes);
    nodes.nodes.forEach((node) => {
        g.setNode(node.index, { label: node.label === undefined ? "" : node.label });

        node.connections.forEach((childIndex) => {
            g.setEdge(node.index, childIndex);
        });
    });

    return dot.write(g);
}

export default createGraph;
