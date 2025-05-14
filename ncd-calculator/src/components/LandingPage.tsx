import React, { useState, useEffect } from "react";
import Header from "./Header";
import HeroSection from "./HeroSection";
import DemoSection from "./DemoSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import VisualizationTypesSection from "./VisualizationTypesSection";
import InfoBanner from "./InfoBanner";
import ResearchSection from "./ResearchSection";
import Footer from "./Footer";

export const LandingPage = ({ openLogin, setOpenLogin, setAuthenticated }) => {
	// Preserve the original navigation function
	const navigateToCalculator = (analysisType) => {
		window.location.href = `/calculator?searchMode=${analysisType}`;
	};
	
	// Handle scroll effect for navbar
	const [isScrolled, setIsScrolled] = useState(false);
	
	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 50);
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);
	
	return (
		<div className="min-h-screen bg-gray-950 text-gray-200">
			<Header
				isScrolled={isScrolled}
				openLogin={openLogin}
				setOpenLogin={setOpenLogin}
			/>
			<HeroSection navigateToCalculator={navigateToCalculator} />
			<DemoSection />
			<FeaturesSection navigateToCalculator={navigateToCalculator} />
			<HowItWorksSection />
			<VisualizationTypesSection />
			<InfoBanner />
			<ResearchSection />
			<Footer />
		</div>
	);
};

