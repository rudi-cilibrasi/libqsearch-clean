export interface PlanarTreeNode {
    index: number;
    label: string;
    connections: number[];
}

export interface PlanarTreeData {
    nodes: PlanarTreeNode[];
}

const escapeDotLabel = (label: string): string => label
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ");

/** Build a high-contrast, left-to-right planar representation of a quartet tree. */
export const createPlanarTreeDot = (data: PlanarTreeData): string => {
    const lines = [
        "digraph G {",
        '  graph [bgcolor="#f7f3e8", rankdir=LR, overlap=false, splines=polyline, nodesep=0.38, ranksep=0.32, pad=0.15, margin=0];',
        '  edge [color="#315b4b", penwidth=1.8, arrowhead=none];'
    ];

    for (const node of data.nodes) {
        const label = escapeDotLabel(node.label?.trim() ?? "");
        const isLeaf = node.connections.length <= 1;

        if (isLeaf) {
            lines.push(
                `  "${node.index}" [label="${label}", shape=box, style=filled, fillcolor="#fffdf7", color="#173c2e", fontcolor="#17231d", fontname="Arial", fontsize=12, penwidth=1.4, margin="0.1,0.07"];`
            );
        } else {
            lines.push(
                `  "${node.index}" [label="", shape=circle, fixedsize=true, width=0.13, height=0.13, style=filled, fillcolor="#b44d36", color="#7b2f20", penwidth=1.2];`
            );
        }
    }

    const nodesByIndex = new Map(data.nodes.map(node => [node.index, node]));
    const roots = [...data.nodes].sort((left, right) => right.connections.length - left.connections.length);
    const visited = new Set<number>();

    for (const root of roots) {
        if (visited.has(root.index)) continue;
        visited.add(root.index);
        const queue = [root.index];

        while (queue.length > 0) {
            const source = queue.shift()!;
            const node = nodesByIndex.get(source);
            if (!node) continue;

            for (const target of node.connections) {
                if (visited.has(target)) continue;
                visited.add(target);
                queue.push(target);
                lines.push(`  "${source}" -> "${target}";`);
            }
        }
    }

    lines.push("}");
    return lines.join("\n");
};
