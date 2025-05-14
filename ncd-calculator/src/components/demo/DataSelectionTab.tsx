import React from "react";
import SearchBar from "../ui/SearchBar";

const DataSelectionTab = () => {
	return (
		<div className="grid md:grid-cols-2 gap-4 p-4">
			<div className="bg-gray-800 rounded-lg p-4">
				<h3 className="text-lg font-medium mb-3">Enter some animal name</h3>
				<div className="mb-4">
					<SearchBar value="dog" onChange={() => {}} />
				</div>
				
				{/* Replace the mock table with the actual screenshot */}
				<div className="relative rounded-lg overflow-hidden border border-gray-700">
					{/* The image container with proper aspect ratio */}
					<div className="aspect-w-16 aspect-h-12 relative">
						{/* The actual screenshot image */}
						<img
							src="/images/ncd_demo_list_editor.jpg"
							alt="Animal selection interface showing search results for dog breeds"
							className="object-cover w-full h-full"
						/>
						
						{/* Optional overlay to ensure the image blends with the dark theme */}
						<div className="absolute inset-0 bg-gray-900/10 pointer-events-none"></div>
					</div>
				</div>
			</div>
			
			<div className="bg-gray-800 rounded-lg p-4">
				<h3 className="text-lg font-medium mb-3">Data Clustering</h3>
				
				{/* Replace with the selected items screenshot */}
				<div className="relative rounded-lg overflow-hidden border border-gray-700">
					<div className="aspect-w-16 aspect-h-12 relative">
						<img
							src="/images/ncd_demo_quartet_tree.jpg"
							alt="Selected dog breeds for analysis"
							className="object-cover w-full h-full"
						/>
						<div className="absolute inset-0 bg-gray-900/10 pointer-events-none"></div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default DataSelectionTab;
