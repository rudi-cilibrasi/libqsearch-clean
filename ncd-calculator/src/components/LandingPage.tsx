import {useNavigate} from "react-router-dom";
import Header from "./Header";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import VisualizationTypesSection from "./VisualizationTypesSection";
import ResearchSection from "./ResearchSection";
import Footer from "./Footer";
import "./LandingPage.css";

export type AnalysisType = "fasta" | "language" | "file_upload";

export interface LandingPageProps {
    openLogin: boolean;
    setOpenLogin: (open: boolean) => void;
    setAuthenticated: (authenticated: boolean) => void;
}

export const LandingPage = ({
    openLogin,
    setOpenLogin,
    setAuthenticated,
}: LandingPageProps) => {
    const navigate = useNavigate();

    const navigateToCalculator = (analysisType: AnalysisType): void => {
        navigate(`/calculator?searchMode=${analysisType}`);
    };

    return (
        <div className="landing-shell">
            <Header
                openLogin={openLogin}
                setOpenLogin={setOpenLogin}
                setAuthenticated={setAuthenticated}
                variant="landing"
            />
            <main>
                <HeroSection navigateToCalculator={navigateToCalculator}/>
                <FeaturesSection navigateToCalculator={navigateToCalculator}/>
                <HowItWorksSection/>
                <VisualizationTypesSection/>
                <ResearchSection/>
            </main>
            <Footer/>
        </div>
    );
};
