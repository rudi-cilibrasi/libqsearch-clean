import { FC } from 'react';
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ExternalLink, Users } from 'lucide-react';

const About: FC = (): JSX.Element => {
    const navigate = useNavigate();

    const handleGoBack = (): void => {
        navigate('/');
    };

    const TeamMember = ({ name, link }: { name: string; link: string }) => (
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-blue-500 transition-all duration-300">
            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-gray-200 hover:text-blue-400 transition-colors"
            >
                <span className="text-lg font-medium">{name}</span>
                <ExternalLink className="h-5 w-5" />
            </a>
        </div>
    );

    return (
        <div className="    text-gray-200">
            {/* Header Section */}
            <header className="w-full px-6 py-16 text-center">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                        About NCD Calculator
                    </h1>
                    <p className="text-xl text-gray-400">
                        Built by researchers and developers dedicated to advancing the field of
                        information theory and compression-based similarity analysis.
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-6 py-8">
                {/* Team Section */}
                <section className="max-w-7xl mx-auto mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <Users className="h-6 w-6 text-blue-400" />
                        <h2 className="text-2xl font-semibold">Our Team</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <TeamMember
                            name="Rudi Cilibrasi"
                            link="https://cilibrar.com/"
                        />
                        <TeamMember
                            name="Paul Vitanyi"
                            link="https://homepages.cwi.nl/~paulv/"
                        />
                        <TeamMember
                            name="Ming Li"
                            link="https://cs.uwaterloo.ca/computer-science/contacts/ming-li"
                        />
                        <TeamMember
                            name="Steven de Rooij"
                            link="https://www.uva.nl/en/profile/r/o/s.derooij/s.de-rooij.html"
                        />
                        <TeamMember
                            name="Maarten Keijzer"
                            link="https://www.h2i.sg/h2i-cto-maarten-keijzer-broadening-the-use-of-ai-ml-in-water-management-to-make-an-impact/"
                        />
                        <TeamMember
                            name="Joy Hughes"
                            link="https://dev.to/joyhughes"
                        />
                        <TeamMember
                            name="Nam V. Do"
                            link="https://github.com/namvdo"
                        />
                        <TeamMember
                            name="Shawn Nguyen"
                            link="https://github.com/Sonnpm197"
                        />
                    </div>
                </section>

                {/* Research Foundation Section */}
                <section className="max-w-4xl mx-auto">
                    {/* Back Button */}
                    <button
                        onClick={handleGoBack}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Back to Home
                    </button>
                </section>
            </main>
        </div>
    );
};
export default About;