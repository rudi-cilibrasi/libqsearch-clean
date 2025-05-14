// components/FeaturesSection.jsx
import React from "react";
import { Database, Languages, Upload } from 'lucide-react';
import FeatureCard from "./ui/FeatureCard";

const FeaturesSection = ({ navigateToCalculator }) => {
	return (
		<div className="relative py-16">
			<div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950"></div>
			<div className="container mx-auto px-4 md:px-6 relative z-10">
				<div className="max-w-5xl mx-auto">
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
						<FeatureCard
							icon={Database}
							title="Genetic Analysis"
							description="Compare genetic sequences using FASTA format to understand evolutionary relationships and similarities between species."
							analysisType="fasta"
							onClick={navigateToCalculator}
						/>
						
						<FeatureCard
							icon={Languages}
							title="Language Analysis"
							description="Analyze translations of texts across different languages to discover linguistic patterns and relationships."
							analysisType="language"
							onClick={navigateToCalculator}
						/>
						
						<FeatureCard
							icon={Upload}
							title="Custom Analysis"
							description="Upload your own files to find hidden patterns and relationships in any type of data."
							analysisType="file_upload"
							onClick={navigateToCalculator}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default FeaturesSection;
