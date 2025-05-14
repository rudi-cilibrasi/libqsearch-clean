// components/demo/VisualizationTab.jsx
import React, { useState } from "react";
import TabButton from "../ui/TabButton";
import TreeVisualization from "./visualizations/TreeVisualization";
import MatrixVisualization from "./visualizations/MatrixVisualization";
import GridVisualization from "./visualizations/GridVisualization";

const VisualizationTab = () => {
	const [activeTab, setActiveTab] = useState('tree');
	
	return (
		<div>
			<div className="relative bg-gray-950 h-80">
				{activeTab === 'tree' && <TreeVisualization />}
				{activeTab === 'matrix' && <MatrixVisualization />}
				{activeTab === 'grid' && <GridVisualization />}
				
			</div>
			
			<div className="bg-gray-800 p-3 flex justify-between items-center">
				<div className="flex gap-2">
					<TabButton active={activeTab === 'tree'} onClick={() => setActiveTab('tree')}>Tree View</TabButton>
					<TabButton active={activeTab === 'matrix'} onClick={() => setActiveTab('matrix')}>Matrix View</TabButton>
					<TabButton active={activeTab === 'grid'} onClick={() => setActiveTab('grid')}>Grid View</TabButton>
				</div>
				<div className="flex gap-2">
					<button className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-sm font-medium text-blue-300">Light Theme</button>
					<button className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 rounded-lg text-sm font-medium text-green-300">Export Graph</button>
				</div>
			</div>
		</div>
	);
};

export default VisualizationTab;
