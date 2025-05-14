// components/HowItWorksSection.jsx
import React from "react";
import { Upload, Zap, GitMerge } from 'lucide-react';

const HowItWorksSection = () => {
	return (
		<div className="relative py-16 overflow-hidden" id="how-it-works">
			<div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/70 to-gray-950"></div>
			<div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"></div>
			<div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl"></div>
			
			<div className="container mx-auto px-4 md:px-6 relative z-10">
				<div className="max-w-5xl mx-auto">
					<h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
					<div className="grid md:grid-cols-3 gap-8">
						<div className="bg-gray-900/80 backdrop-blur-sm p-6 rounded-lg border border-gray-800 hover:border-blue-500/30 transition-all duration-300">
							<div className="text-2xl font-bold text-blue-400 mb-2">1</div>
							<h3 className="text-xl font-semibold mb-2">Upload Your Data</h3>
							<p className="text-gray-400">
								Select your files or paste your sequences directly into the tool. Our smart search helps you find items quickly.
							</p>
							<div className="mt-4 flex items-center gap-2 text-blue-300 text-sm">
								<Upload className="h-4 w-4" />
								<span>FASTA, Text, or Custom Files</span>
							</div>
						</div>
						
						<div className="bg-gray-900/80 backdrop-blur-sm p-6 rounded-lg border border-gray-800 hover:border-blue-500/30 transition-all duration-300">
							<div className="text-2xl font-bold text-blue-400 mb-2">2</div>
							<h3 className="text-xl font-semibold mb-2">Analyze</h3>
							<p className="text-gray-400">
								Our algorithm processes your data using advanced compression techniques for universal similarity measurement.
							</p>
							<div className="mt-4 flex items-center gap-2 text-green-300 text-sm">
								<Zap className="h-4 w-4" />
								<span>Optimized with Multi-Layer Caching</span>
							</div>
						</div>
						
						<div className="bg-gray-900/80 backdrop-blur-sm p-6 rounded-lg border border-gray-800 hover:border-blue-500/30 transition-all duration-300">
							<div className="text-2xl font-bold text-blue-400 mb-2">3</div>
							<h3 className="text-xl font-semibold mb-2">Visualize</h3>
							<p className="text-gray-400">
								Explore the results through interactive 3D visualizations, matrices, and grid layouts to discover patterns.
							</p>
							<div className="mt-4 flex items-center gap-2 text-purple-300 text-sm">
								<GitMerge className="h-4 w-4" />
								<span>Tree, Matrix, and Grid Views</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default HowItWorksSection;
