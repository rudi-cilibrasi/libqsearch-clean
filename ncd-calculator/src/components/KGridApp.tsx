import React, { useState, useEffect, useCallback } from 'react';
import { KGridDualOptimization } from './KGridDualOptimization';
import { GridObject } from '@/services/kgrid.ts';
import {
    Dna,
    AlertTriangle,
    HelpCircle,
    Maximize2,
    Minimize2
} from 'lucide-react';

interface KGridAppProps {
    width?: number;
    height?: number;
    objects?: GridObject[];
    maxIterations?: number;
    ncdMatrixOverride?: number[][];
    labels?: string[];
}

/**
 * KGridApp component that visualizes clustering based on NCD values
 * This can either use objects with their own content for NCD calculation
 * or take pre-computed NCD matrix values
 */
const KGridApp: React.FC<KGridAppProps> = ({
                                               width = 3,
                                               height = 3,
                                               objects = [],
                                               maxIterations = 50000,
                                               ncdMatrixOverride,
                                               labels
                                           }) => {
    // State for the transformed objects and matrix
    const [gridObjects, setGridObjects] = useState<GridObject[]>([]);
    const [isDataReady, setIsDataReady] = useState(false);
    const [dataQualityWarning, setDataQualityWarning] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    // Transform the provided data for K-Grid visualization
    useEffect(() => {
        // If we have both NCD matrix and labels, prepare the data
        if (ncdMatrixOverride && labels && labels.length > 0) {
            prepareDataFromMatrix(labels, ncdMatrixOverride);
        }
        // Otherwise, use the provided objects directly
        else if (objects && objects.length > 0) {
            // Ensure all objects have string IDs
            const processedObjects = objects.map(obj => ({
                ...obj,
                id: String(obj.id)
            }));

            // Ensure unique objects by ID
            const uniqueIdsMap = new Map();
            processedObjects.forEach(obj => {
                if (!uniqueIdsMap.has(obj.id)) {
                    uniqueIdsMap.set(obj.id, obj);
                }
            });

            // Convert map back to array
            const uniqueObjects = Array.from(uniqueIdsMap.values());

            setGridObjects(uniqueObjects);
            setIsDataReady(true);

        }
        // No valid input
        else {
            setIsDataReady(false);
            setDataQualityWarning("No data provided for visualization");
        }
    }, [ncdMatrixOverride, labels, objects]);

    /**
     * Prepare data from provided NCD matrix and labels
     */
    const prepareDataFromMatrix = useCallback((labelList: string[], matrix: number[][]) => {
        try {
            // Create GridObjects from the labels
            const generatedObjects: GridObject[] = labelList.map((label, index) => ({
                id: String(index),
                label: label,
                // Include minimal content to satisfy the interface
                content: `Data for ${label}`
            }));

            // Create a mapping for the NCD matrix
            const ncdMatrixMapping: Record<string, Record<string, number>> = {};

            // Initialize the structure
            labelList.forEach((_, i) => {
                ncdMatrixMapping[String(i)] = {};
            });

            labelList.forEach((_, i) => {
                labelList.forEach((_, j) => {
                    ncdMatrixMapping[String(i)][String(j)] = matrix[i][j];
                });
            });

            // Update state
            setGridObjects(generatedObjects);
            setIsDataReady(true);

            console.log('Data prepared for KGridApp from matrix:', {
                objects: generatedObjects,
                matrixSize: `${matrix.length}x${matrix[0]?.length}`
            });
        } catch (error) {
            console.error('Error preparing data from matrix:', error);
            setDataQualityWarning(`Error preparing visualization data: ${error instanceof Error ? error.message : String(error)}`);
            setIsDataReady(false);
        }
    }, []);


    // Calculate optimal dimensions if not specified
    const getOptimalDimensions = () => {
        if (width !== 3 || height !== 3) {
            return { width, height };
        }

        const itemCount = gridObjects.length;
        const optimalWidth = Math.ceil(Math.sqrt(itemCount));
        const optimalHeight = Math.ceil(itemCount / optimalWidth);

        return { width: optimalWidth, height: optimalHeight };
    };

    const { width: displayWidth, height: displayHeight } = getOptimalDimensions();

    // Toggle fullscreen mode for better visualization
    const toggleExpanded = () => {
        setExpanded(!expanded);
    };

    if (!isDataReady) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '64px',
                color: 'black'
            }}>
                <div style={{textAlign: 'center'}}>
                    <div style={{
                        animation: 'spin 1s linear infinite',
                        borderRadius: '50%',
                        height: '48px',
                        width: '48px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: '#e5e7eb',
                        borderTopColor: '#3b82f6',
                        margin: '0 auto 16px auto'
                    }}></div>
                    <p style={{color: '#6b7280'}}>Preparing visualization data...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: expanded ? 'fixed' : 'relative',
            inset: expanded ? 0 : 'auto',
            zIndex: expanded ? 50 : 'auto',
            backgroundColor: expanded ? 'white' : 'transparent',
            padding: expanded ? '24px' : 0,
            overflow: expanded ? 'auto' : 'visible'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <h2 style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0
                }}>
                    <Dna size={20} style={{color: '#2563eb'}} />
                    K-Grid Clustering Visualization
                </h2>
                <button
                    onClick={toggleExpanded}
                    style={{
                        padding: '8px',
                        color: '#6b7280',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer'
                    }}
                    title={expanded ? "Exit fullscreen" : "View fullscreen"}
                >
                    {expanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
            </div>

            {dataQualityWarning && (
                <div style={{
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    padding: '16px',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    border: '1px solid #ffeeba',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                }}>
                    <AlertTriangle size={16} />
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Data Quality Warning</div>
                        <div>{dataQualityWarning}</div>
                        <div style={{marginTop: '8px', fontSize: '14px'}}>
                            K-Grid works best with data that has well-differentiated similarity relationships.
                        </div>
                    </div>
                </div>
            )}

            <div style={{
                padding: '16px',
                backgroundColor: '#eff6ff',
                borderRadius: '8px',
                marginBottom: '24px'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                }}>
                    <HelpCircle size={20} style={{color: '#2563eb', flexShrink: 0, marginTop: '4px'}} />
                    <div>
                        <h3 style={{
                            fontWeight: '500',
                            color: '#1e40af',
                            margin: 0
                        }}>How to Read This Visualization</h3>
                        <p style={{
                            marginTop: '4px',
                            color: '#1e3a8a',
                            fontSize: '14px'
                        }}>
                            This visualization shows two K-Grid optimizations running independently. Both grids
                            attempt to arrange items so that similar ones (with lower NCD values) are placed
                            next to each other. If both grids converge to the same arrangement, it indicates
                            a strong clustering pattern in the data.
                        </p>
                        <p style={{
                            marginTop: '8px',
                            color: '#1e3a8a',
                            fontSize: '14px'
                        }}>
                            Items with similar colors represent similar entities. The closer items are positioned
                            to each other, the more similar their content is according to Normalized Compression
                            Distance (NCD).
                        </p>
                    </div>
                </div>
            </div>

            <div style={{
                height: expanded ? 'calc(100vh - 220px)' : '600px'
            }}>
                <KGridDualOptimization
                    width={displayWidth}
                    height={displayHeight}
                    objects={gridObjects}
                    maxIterations={maxIterations}
                    ncdMatrixOverride={ncdMatrixOverride}
                />
            </div>

            <div style={{
                marginTop: '16px',
                textAlign: 'center',
                fontSize: '14px',
                color: '#6b7280'
            }}>
                <p style={{margin: 0}}>
                    Using {displayWidth}×{displayHeight} grid to visualize {gridObjects.length} items.
                    Max iterations: {maxIterations}.
                </p>
            </div>
        </div>
    );
};

export default KGridApp;
