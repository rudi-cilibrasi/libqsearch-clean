// components/DemoSection.jsx
import React, { useState } from "react";
import { Database, BarChart2 } from 'lucide-react';
import DataSelectionTab from "./demo/DataSelectionTab";
import VisualizationTab from "./demo/VisualizationTab";

const DemoSection = () => {
	const [activeDemo, setActiveDemo] = useState('selection');
	
	return (
		<div className="container mx-auto px-4 md:px-6 relative z-10 mb-16">
			<div className="max-w-5xl mx-auto bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
				<div className="flex border-b border-gray-800">
					<button
						className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${activeDemo === 'selection' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
						onClick={() => setActiveDemo('selection')}
					>
						<Database className="h-4 w-4" />
						Data Selection
					</button>
					<button
						className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${activeDemo === 'visualization' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
						onClick={() => setActiveDemo('visualization')}
					>
						<BarChart2 className="h-4 w-4" />
						Results Visualization
					</button>
				</div>
				
				{activeDemo === 'selection' ? <DataSelectionTab /> : <VisualizationTab />}
			</div>
		</div>
	);
};

export default DemoSection;
