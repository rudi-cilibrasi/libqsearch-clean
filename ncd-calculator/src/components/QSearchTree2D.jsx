// src/components/TwoDTreeVisualizer.jsx
import React from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export const TwoDTreeVisualizer = ({ data }) => {
    if (!data || !data.nodes || data.nodes.length === 0) {
        return <div></div>
    }
    const nodes = data.nodes.map((node) => ({
        id: node.index,
        label: node.label.toUpperCase(),
    }));

    const links = data.nodes.flatMap((node) =>
        node.connections.map((connection) => ({
            source: node.index,
            target: connection,
        }))
    );

    const graphData = { nodes, links };

    return (
        <ForceGraph2D
            graphData={graphData}
            nodeLabel="label"
            nodeAutoColorBy="id"
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkWidth={1}
            linkDistance={100}
            nodeCanvasObject={(node, ctx, globalScale) => {
                const fontSize = Math.max(8, 12 / globalScale);
                ctx.font = `${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillStyle = 'blue';
                ctx.beginPath();
                ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.fillText(node.label, node.x, node.y - 10);
            }}
            width={700}
            height={500}
        />
    );
};
