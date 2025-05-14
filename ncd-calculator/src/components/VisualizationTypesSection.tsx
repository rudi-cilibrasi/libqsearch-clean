import React from "react";
import { GitMerge, BarChart2, Grid } from 'lucide-react';

const VisualizationTypesSection = () => {
	return (
		<div className="py-16 bg-gray-900">
			<div className="container mx-auto px-4 md:px-6">
				<div className="max-w-5xl mx-auto">
					<h2 className="text-3xl font-bold mb-6 text-center">Interactive Visualizations</h2>
					<p className="text-lg text-gray-400 text-center max-w-3xl mx-auto mb-12">
						Explore your data from multiple perspectives with our interactive visualization tools.
					</p>
					
					<div className="grid md:grid-cols-3 gap-6">
						<div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500/30 transition-all duration-300 group">
							<div className="p-4 border-b border-gray-700 flex justify-between items-center">
								<div className="flex items-center gap-2">
									<GitMerge className="h-5 w-5 text-blue-400" />
									<h3 className="font-medium">3D Quartet Tree</h3>
								</div>
								<div className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">Popular</div>
							</div>
							<div className="p-4 bg-gray-850 h-40 flex items-center justify-center bg-gray-900 group-hover:bg-gray-850 transition-colors">
								<div className="w-16 h-16 flex items-center justify-center bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform">
									<div className="w-10 h-10 flex items-center justify-center bg-blue-500/20 rounded-full">
										<div className="w-5 h-5 bg-blue-500 rounded-full"></div>
									</div>
								</div>
							</div>
							<div className="p-4 text-sm text-gray-300">
								<p>Visualize hierarchical clustering in 3D space to discover natural groupings in your data.</p>
							</div>
						</div>
						
						<div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500/30 transition-all duration-300 group">
							<div className="p-4 border-b border-gray-700 flex items-center gap-2">
								<BarChart2 className="h-5 w-5 text-blue-400" />
								<h3 className="font-medium">NCD Matrix</h3>
							</div>
							<div className="p-4 bg-gray-850 h-40 flex items-center justify-center bg-gray-900 group-hover:bg-gray-850 transition-colors">
								<div className="grid grid-cols-4 gap-1 group-hover:scale-110 transition-transform">
									{Array(16).fill().map((_, i) => (
										<div
											key={i}
											className="w-6 h-6 flex items-center justify-center text-xs"
											style={{
												backgroundColor: i % 5 === 0
													? 'rgba(30, 64, 175, 0.8)'
													: `rgba(30, 64, 175, ${0.2 + (i % 10) * 0.05})`,
												color: i % 5 === 0 ? 'white' : 'rgba(255,255,255,0.5)'
											}}
										>
											{i % 5 === 0 ? '0' : ((i % 10) / 10).toFixed(1)}
										</div>
									))}
								</div>
							</div>
							<div className="p-4 text-sm text-gray-300">
								<p>Examine precise similarity scores between each pair of items in your dataset.</p>
							</div>
						</div>
						
						<div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500/30 transition-all duration-300 group">
							<div className="p-4 border-b border-gray-700 flex items-center gap-2">
								<Grid className="h-5 w-5 text-blue-400" />
								<h3 className="font-medium">Grid Layout</h3>
							</div>
							<div className="p-4 bg-gray-850 h-40 flex items-center justify-center bg-gray-900 group-hover:bg-gray-850 transition-colors">
								<div className="grid grid-cols-2 grid-rows-2 gap-3 group-hover:scale-110 transition-transform">
									<div className="w-12 h-12 bg-red-500/30 rounded flex items-center justify-center text-xs">1</div>
									<div className="w-12 h-12 bg-blue-500/30 rounded flex items-center justify-center text-xs">2</div>
									<div className="w-12 h-12 bg-green-500/30 rounded flex items-center justify-center text-xs">3</div>
									<div className="w-12 h-12 bg-yellow-500/30 rounded flex items-center justify-center text-xs">4</div>
								</div>
							</div>
							<div className="p-4 text-sm text-gray-300">
								<p>Organize data in optimized spatial arrangements for better clustering visualization.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default VisualizationTypesSection;
