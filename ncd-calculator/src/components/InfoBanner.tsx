import React from "react";
import { Info } from 'lucide-react';

const InfoBanner = () => {
	return (
		<div className="container mx-auto px-4 md:px-6 py-16">
			<div className="max-w-5xl mx-auto">
				<div className="relative overflow-hidden bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-6 border border-blue-500/20">
					{/* Animated gradient overlay */}
					<div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-80 animate-pulse"></div>
					
					<div className="flex items-start gap-4 relative z-10">
						<Info className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
						<div className="text-left">
							<h3 className="text-lg font-semibold mb-2">Why Use NCD Calculator?</h3>
							<p className="text-gray-300">
								NCD (Normalized Compression Distance) is a universal similarity metric that works
								on any type of data. Unlike traditional comparison methods, it doesn't require
								specific domain knowledge or predefined features, making it incredibly versatile
								for discovering patterns in your data.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InfoBanner;
