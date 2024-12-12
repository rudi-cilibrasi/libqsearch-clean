import { useNavigate } from 'react-router-dom';
import {Upload, Database, Languages, ChevronRight, Info, ExternalLink} from 'lucide-react';
import Header from './Header';
import React from "react";

const LandingPage = ({ openLogin, setOpenLogin, setAuthenticated }) => {
    const navigate = useNavigate();

    const navigateToCalculator = (analysisType) => {
        navigate(`/calculator?type=${analysisType}`);
    };

    const FeatureCard = ({ icon: Icon, title, description, analysisType, comingSoon = false }) => (
        <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 hover:border-blue-500 transition-all duration-300">
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
                onClick={() => !comingSoon && navigateToCalculator(analysisType)}
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
    );

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200">
            <Header
                openLogin={openLogin}
                setOpenLogin={setOpenLogin}
                setAuthenticated={setAuthenticated}
            />

            <main className="container mx-auto px-4 py-16">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                        Discover Hidden Patterns in Your Data
                    </h1>
                    <p className="text-xl text-gray-400">
                        Using Normalized Compression Distance (NCD), our calculator reveals similarities
                        in your data that traditional methods might miss. Perfect for researchers,
                        students, and curious minds alike.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    <FeatureCard
                        icon={Database}
                        title="Genetic Analysis"
                        description="Compare genetic sequences using FASTA format to understand evolutionary relationships and similarities between species."
                        analysisType="genetic"
                    />

                    <FeatureCard
                        icon={Languages}
                        title="Language Analysis"
                        description="Analyze translations of texts across different languages to discover linguistic patterns and relationships."
                        analysisType="language"
                    />

                    <FeatureCard
                        icon={Upload}
                        title="Custom Analysis"
                        description="Upload your own files to find hidden patterns and relationships in any type of data."
                        analysisType="custom"
                    />
                </div>

                <div className="mt-24 max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-8">How It Works</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="p-6">
                            <div className="text-2xl font-bold text-blue-400 mb-2">1</div>
                            <h3 className="text-xl font-semibold mb-2">Upload Your Data</h3>
                            <p className="text-gray-400">Select your files or paste your sequences directly into the
                                tool.</p>
                        </div>
                        <div className="p-6">
                            <div className="text-2xl font-bold text-blue-400 mb-2">2</div>
                            <h3 className="text-xl font-semibold mb-2">Analyze</h3>
                            <p className="text-gray-400">Our algorithm processes your data using advanced compression
                                techniques.</p>
                        </div>
                        <div className="p-6">
                            <div className="text-2xl font-bold text-blue-400 mb-2">3</div>
                            <h3 className="text-xl font-semibold mb-2">Visualize</h3>
                            <p className="text-gray-400">View the results in interactive 3D visualizations and
                                dendrograms.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-16 bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 max-w-3xl mx-auto">
                    <div className="flex items-start gap-4">
                        <Info className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1"/>
                        <div>
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

                <div className="mt-16 text-center max-w-3xl mx-auto">
                    <div className="bg-gray-900/50 rounded-lg p-8 border border-gray-800">
                        <h2 className="text-2xl font-semibold mb-6">Research Foundation</h2>
                        <p className="text-gray-300 mb-6">
                            This calculator is based on groundbreaking research in information theory
                            and data compression. The core methodology comes from the seminal paper
                            "Clustering by Compression" by Rudi Cilibrasi and Paul Vitányi, which
                            introduced the theoretical foundations for using compression techniques
                            to measure similarity between data objects.
                        </p>
                        <div
                            className="inline-flex items-center gap-2 bg-blue-500/10 px-6 py-3 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                            <a
                                href="https://homepages.cwi.nl/~paulv/papers/cluster.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium"
                            >
                                Read the Research Paper
                                <ExternalLink className="h-4 w-4"/>
                            </a>
                        </div>
                    </div>

                    <div className="mt-8 text-sm text-gray-500">
                        © 2024 NCD Calculator. Part of Open Science Research Park.
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LandingPage;