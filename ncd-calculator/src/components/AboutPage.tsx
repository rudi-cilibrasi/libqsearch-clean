import {ExternalLink} from "lucide-react";
import {Link} from "react-router-dom";
import Footer from "./Footer";
import Header from "./Header";
import "./AboutPage.css";

interface AboutPageProps {
    setOpenLogin: (open: boolean) => void;
    setAuthenticated: (authenticated: boolean) => void;
}

interface TeamMember {
    name: string;
    link: string;
}

const TEAM_MEMBERS: TeamMember[] = [
    {name: "Rudi Cilibrasi", link: "https://cilibrar.com/"},
    {name: "Paul Vitányi", link: "https://homepages.cwi.nl/~paulv/"},
    {name: "Ming Li", link: "https://cs.uwaterloo.ca/computer-science/contacts/ming-li"},
    {name: "Steven de Rooij", link: "https://www.uva.nl/en/profile/r/o/s.derooij/s.de-rooij.html"},
    {name: "Maarten Keijzer", link: "https://www.h2i.sg/h2i-cto-maarten-keijzer-broadening-the-use-of-ai-ml-in-water-management-to-make-an-impact/"},
    {name: "Joy Hughes", link: "https://dev.to/joyhughes"},
    {name: "Nam V. Do", link: "https://github.com/namvdo"},
    {name: "Shawn Nguyen", link: "https://github.com/Sonnpm197"},
];

const AboutPage = ({
    setOpenLogin,
    setAuthenticated,
}: AboutPageProps): JSX.Element => {
    return (
        <div className="about-shell">
            <Header
                setOpenLogin={setOpenLogin}
                setAuthenticated={setAuthenticated}
            />

            <main id="main-content" tabIndex={-1}>
                <section className="about-hero" aria-labelledby="about-title">
                    <div className="landing-container about-hero__grid">
                        <div>
                            <p className="about-kicker">About CompLearn</p>
                            <h1 id="about-title">Compression as a scientific instrument.</h1>
                            <p className="about-hero__lead">
                                CompLearn provides practical tools for comparing sequences, texts,
                                and files through normalized compression distance. The method uses
                                compressed length instead of hand-designed domain features.
                            </p>
                            <div className="about-actions">
                                <Link className="landing-button landing-button--primary" to="/calculator?searchMode=file_upload">
                                    Open workbench
                                </Link>
                                <a
                                    className="landing-text-link"
                                    href="https://github.com/rudi-cilibrasi/libqsearch-clean"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View source <span aria-hidden="true">↗</span>
                                </a>
                            </div>
                        </div>

                        <figure className="about-equation">
                            <figcaption>NCD definition</figcaption>
                            <div className="about-equation__formula" aria-label="Normalized compression distance equation">
                                <span>NCD(x, y)</span>
                                <span>=</span>
                                <span className="about-equation__fraction">
                                    <span>C(xy) − min(C(x), C(y))</span>
                                    <span>max(C(x), C(y))</span>
                                </span>
                            </div>
                            <dl>
                                <div>
                                    <dt>C(x)</dt>
                                    <dd>compressed length of one object</dd>
                                </div>
                                <div>
                                    <dt>C(xy)</dt>
                                    <dd>compressed length of the paired objects</dd>
                                </div>
                            </dl>
                        </figure>
                    </div>
                </section>

                <section className="about-section" aria-labelledby="contributors-title">
                    <div className="landing-container">
                        <header className="about-section__heading">
                            <p className="about-section__index">01 / Contributors</p>
                            <h2 id="contributors-title">Research and engineering contributors.</h2>
                        </header>

                        <ol className="about-team">
                            {TEAM_MEMBERS.map((member, index) => (
                                <li key={member.name}>
                                    <span>{String(index + 1).padStart(2, "0")}</span>
                                    <a href={member.link} target="_blank" rel="noopener noreferrer">
                                        <strong>{member.name}</strong>
                                        <ExternalLink size={16} aria-hidden="true"/>
                                        <span className="sr-only"> opens in a new tab</span>
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="about-section about-foundation" aria-labelledby="foundation-title">
                    <div className="landing-container about-foundation__grid">
                        <div>
                            <p className="about-section__index">02 / Research basis</p>
                            <h2 id="foundation-title">From information distance to an executable method.</h2>
                        </div>
                        <div className="about-foundation__text">
                            <p>
                                Normalized compression distance is a computable approximation of
                                normalized information distance. A real compressor acts as the model:
                                objects are considered similar when their joint description is shorter
                                than the descriptions of unrelated objects.
                            </p>
                            <p>
                                Results depend on the compressor, object size, and input preparation.
                                These choices are experimental parameters and should be reported when
                                NCD is used in research.
                            </p>
                            <div className="about-citation">
                                <span>Cilibrasi, R. &amp; Vitányi, P. M. B.</span>
                                <cite>Clustering by Compression</cite>
                                <span>IEEE Transactions on Information Theory, 2005</span>
                            </div>
                            <a
                                className="landing-text-link"
                                href="https://homepages.cwi.nl/~paulv/papers/cluster.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Read the paper <span aria-hidden="true">↗</span>
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <Footer/>
        </div>
    );
};

export default AboutPage;
