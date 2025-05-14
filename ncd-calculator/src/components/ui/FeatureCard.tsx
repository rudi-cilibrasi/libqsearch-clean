// components/ui/FeatureCard.jsx
import React from "react";
import { ChevronRight } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description, analysisType, comingSoon = false, onClick }) => (
	<div className="bg-gray-900 rounded-lg p-8 border border-gray-800 hover:border-blue-500 transition-all duration-300 relative overflow-hidden group">
		{/* Adding subtle gradient background that shows on hover */}
		<div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-purple-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
		
		<div className="relative z-10">
			<div className="flex items-center gap-3 mb-4">
				<Icon className="h-8 w-8 text-blue-400" />
				<h2 className="text-2xl font-bold text-white">{title}</h2>
				{comingSoon && (
					<span className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full">
            Coming Soon
          </span>
				)}
			</div>
			<p className="text-gray-300 mb-6">{description}</p>
			<button
				onClick={() => !comingSoon && onClick(analysisType)}
				className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors duration-200
        ${comingSoon
					? 'bg-gray-700 text-gray-400 cursor-not-allowed'
					: 'bg-blue-600 hover:bg-blue-700 text-white'}`}
				disabled={comingSoon}
			>
				{comingSoon ? 'Coming Soon' : 'Try Now'}
				<ChevronRight className="h-4 w-4" />
			</button>
		</div>
	</div>
);

export default FeatureCard;
