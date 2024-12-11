import { FC } from 'react';
import {useNavigate} from "react-router-dom";

type AboutPageProps = {};

const About: FC<AboutPageProps> = (): JSX.Element => {
    const navigate = useNavigate();

    const handleGoBack = (): void => {
        navigate('/');
    };

    return (
        <div className="min-h-screen w-[60vw] bg-gray-100 text-gray-800">
            {/* Header Section */}
            <header className="bg-blue-700 text-white py-8 text-center">
                <h1 className="text-4xl font-bold">About Us</h1>
                <p className="mt-2 text-lg">Learn more about who we are and what we do</p>
            </header>

            {/* Main Content */}
            <main className="py-10 px-4 sm:px-10 lg:px-20">
                <section>
                    <h2 className="text-2xl font-semibold mb-4">Our Team</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://cilibrar.com/" target="_blank" rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Rudi Cilibrasi</h3>
                            </a>
                        </div>

                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://homepages.cwi.nl/~paulv/" target="_blank" rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Paul Vitanyi</h3>
                            </a>
                        </div>

                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://cs.uwaterloo.ca/computer-science/contacts/ming-li" target="_blank"
                               rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Ming Li</h3>
                            </a>
                        </div>

                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://www.uva.nl/en/profile/r/o/s.derooij/s.de-rooij.html" target="_blank"
                               rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Steven de Rooij</h3>
                            </a>
                        </div>

                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://www.h2i.sg/h2i-cto-maarten-keijzer-broadening-the-use-of-ai-ml-in-water-management-to-make-an-impact/"
                               target="_blank" rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Maarten Keijzer</h3>
                            </a>
                        </div>

                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://dev.to/joyhughes" target="_blank" rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Joy Hughes</h3>
                            </a>
                        </div>

                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://github.com/namvdo" target="_blank" rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Nam V. Do</h3>
                            </a>
                        </div>

                        <div className="bg-white shadow-md rounded-lg p-6 text-center">
                            <a href="https://github.com/Sonnpm197" target="_blank" rel="noopener noreferrer">
                                <h3 className="text-lg font-semibold">Shawn Nguyen</h3>
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <button
                onClick={handleGoBack}
                className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Back to Home page
            </button>
        </div>
    );
};

export default About;
