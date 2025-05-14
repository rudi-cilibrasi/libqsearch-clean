import { Zap } from 'lucide-react';
import ParticleBackground from "./ui/ParticleBackground";

const HeroSection = ({ navigateToCalculator }) => {
	return (
		<div className="relative pt-20 pb-16 md:py-32">
			<ParticleBackground />
			<div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/50 to-gray-950"></div>
			<div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-blue-500/10 rounded-full filter blur-[100px]"></div>
			<div className="absolute bottom-1/4 right-1/4 w-1/2 h-1/2 bg-purple-500/10 rounded-full filter blur-[100px]"></div>
			
			<div className="container mx-auto px-4 md:px-6 relative z-10">
				<div className="text-center max-w-4xl mx-auto mb-16">
					<h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
						Discover Hidden Patterns in Your Data
					</h1>
					<p className="text-lg md:text-xl text-gray-400 mb-10">
						Using Normalized Compression Distance (NCD), our calculator reveals similarities
						in your data that traditional methods might miss. Perfect for researchers,
						students, and curious minds alike.
					</p>
					<div className="flex flex-col sm:flex-row justify-center gap-4">
						<button
							onClick={() => navigateToCalculator('demo')}
							className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors flex items-center justify-center gap-2"
						>
							<Zap className="h-5 w-5" />
							Try The Calculator
						</button>
						<a
							href="#how-it-works"
							className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors flex items-center justify-center gap-2"
						>
							Learn How It Works
						</a>
					</div>
				</div>
			</div>
		</div>
	);
};

export default HeroSection;
