import React, {useEffect, useState} from "react";
import {GridObject} from "@/services/kgrid.ts";
import KGridApp from "@/components/KGridApp.tsx";
import {LabelManager} from "@/functions/labelUtils.ts";

export const KGridVisualizer: React.FC<{
    labels: string[],
    ncdMatrix: number[][],
    labelManager: LabelManager
}> = ({labels, ncdMatrix, labelManager}) => {
    const [gridObjects, setGridObjects] = useState<GridObject[]>([]);
    const [isDataReady, setIsDataReady] = useState(false);

    useEffect(() => {
        if (!labels || !ncdMatrix || labels.length === 0 || ncdMatrix.length === 0) {
            setIsDataReady(false);
            return;
        }

        console.log("NCD labels: " + JSON.stringify(labels) + "\n" + "Calculated NCD matrix: " + JSON.stringify(ncdMatrix));

        try {
            // Extract the actual sequence IDs from the labels
            // FASTA sequence headers are typically formatted as ">ID description"
            // We need to parse out the ID portion from each label
            const sequenceIds = labels.map(label => {
                // Parse out the ID from FASTA-style label
                // If label is like "Felis catus (Felis catus) [PP070533.1]", extract "[PP070533.1]"
                const idMatch = label.match(/\[([^\]]+)\]/);
                if (idMatch && idMatch[1]) {
                    return idMatch[1]; // Return the actual sequence ID
                }

                // If there's no bracketed ID, try to extract the first word as ID
                const firstWordMatch = label.match(/^(\S+)/);
                if (firstWordMatch && firstWordMatch[1]) {
                    return firstWordMatch[1];
                }

                // Fallback: use the entire label as ID if no pattern matches
                return label;
            });

            // Create NCD matrix mapping using actual sequence IDs
            const ncdMatrixMapping = {};

            // Initialize the matrix structure with sequence IDs
            sequenceIds.forEach(id => {
                ncdMatrixMapping[id] = {};
            });

            // Fill in the NCD values using the original matrix
            for (let i = 0; i < labels.length; i++) {
                for (let j = 0; j < labels.length; j++) {
                    ncdMatrixMapping[sequenceIds[i]][sequenceIds[j]] = ncdMatrix[i][j];
                }
            }

            // Create GridObjects using the actual sequence IDs
            const objects = labels.map((label, index) => ({
                id: sequenceIds[index],  // Use the actual sequence ID
                label: labelManager.getDisplayLabel(label),            // Use the original label for display
                content: `Content for ${label}`
            }));

            // Check if we have duplicate IDs and warn about them
            const uniqueIds = new Set(sequenceIds);
            if (uniqueIds.size < sequenceIds.length) {
                console.warn(
                    `Warning: Found duplicate sequence IDs. ${sequenceIds.length - uniqueIds.size} duplicates detected.`,
                    "This may cause issues with grid visualization."
                );

                // Additional debugging to identify duplicates
                const idCounts = {};
                sequenceIds.forEach(id => {
                    idCounts[id] = (idCounts[id] || 0) + 1;
                });

                const duplicates = Object.entries(idCounts)
                    .filter(([_, count]) => count > 1)
                    .map(([id, count]) => `${id} (${count} occurrences)`);

                console.warn("Duplicate IDs:", duplicates.join(", "));
            }

            setGridObjects(objects);
            setIsDataReady(true);

            console.log('Data prepared for KGridApp:', {
                objects,
                ncdMatrixMapping,
                sequenceIds
            });
        } catch (e) {
            console.error('Error preparing data for KGrid:', e);
            setIsDataReady(false);
        }
    }, [labels, ncdMatrix]);


    if (!isDataReady) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Preparing visualization data...</p>
                </div>
            </div>
        );
    }

    const calculateGridDimension = (itemCount: number) => {
        const width = Math.ceil(Math.sqrt(itemCount));
        const height = Math.ceil(itemCount / width);
        return {width, height};
    }

    const { width, height } = calculateGridDimension(labels.length);

    return (
        <div className="mt-8">
            <div className="bg-blue-900 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4">Animal Genome Similarity Visualization</h2>
                <p className="text-gray-600 mb-6">
                    This visualization shows the relationship between animal genomes based on
                    Normalized Compression Distance (NCD). Similar animals are placed closer together
                    in the grid arrangement. The algorithm starts with two random arrangements and
                    optimizes them until they converge to the same pattern.
                </p>

                {/* Pass the transformed data to KGridApp */}
                <KGridApp
                    width={width}
                    height={height}
                    objects={gridObjects}
                    ncdMatrixOverride={ncdMatrix}
                    maxIterations={50000}
                />

                <div className="mt-6 bg-blue-50 p-4 rounded-md">
                    <h3 className="font-medium text-blue-800 mb-2">How to Interpret This Visualization</h3>
                    <p className="text-blue-700 text-sm">
                        The K-Grid visualization arranges animals so that those with similar genomic
                        patterns appear close to each other. Colors indicate different animal types,
                        and both grids should eventually converge to the same arrangement if the
                        data has clear similarity patterns.
                    </p>
                </div>
            </div>
        </div>
    );
}
