import React from "react";
import {ExternalLink, Info} from 'lucide-react';

const ResearchSection = () => {
	return (
		
		
		<div className="container mx-auto px-4 md:px-6 py-10">
			<div className="max-w-5xl mx-auto">
				<div className="relative overflow-hidden bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-6 border border-blue-500/20">
					<div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-80 animate-pulse"></div>
						<div className="flex items-start gap-4 relative z-10">
							<Info className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
							<div className="text-left">
								<h3 className="text-lg font-semibold mb-2">Research Foundation</h3>
								<p className="text-gray-300 pb-4">
									This calculator is based on groundbreaking research in information theory
									and data compression. The core methodology comes from the seminal paper
									"Clustering by Compression" by Rudi Cilibrasi and Paul Vitányi, which
									introduced the theoretical foundations for using compression techniques
									to measure similarity between data objects.
								</p>
								<a
									className="inline-flex items-center gap-4 bg-blue-500/10 px-6 py-3 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
									href="https://homepages.cwi.nl/~paulv/papers/cluster.pdf"
									target="_blank"
									rel="noopener noreferrer">
									Read the Research Paper
									<ExternalLink className="h-4 w-4"/>
								</a>
							</div>
						</div>
				</div>
			</div>
		</div>
	);
};

export default ResearchSection;
