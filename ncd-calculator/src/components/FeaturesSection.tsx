import type {AnalysisType} from "./LandingPage";

interface FeaturesSectionProps {
    navigateToCalculator: (analysisType: AnalysisType) => void;
}

const applications: Array<{
    index: string;
    type: AnalysisType;
    title: string;
    format: string;
    description: string;
    action: string;
}> = [
    {
        index: "01",
        type: "fasta",
        title: "Biological sequences",
        format: "FASTA / GenBank",
        description: "Compare nucleotide or protein sequences without alignment or a hand-built evolutionary model.",
        action: "Analyze sequences",
    },
    {
        index: "02",
        type: "language",
        title: "Languages and corpora",
        format: "UTF-8 text",
        description: "Study repeated structure across translations, authors, document families, or unknown text collections.",
        action: "Compare languages",
    },
    {
        index: "03",
        type: "file_upload",
        title: "Arbitrary objects",
        format: "Local files",
        description: "Treat any file as a byte sequence and test whether compression exposes a useful notion of relatedness.",
        action: "Use local files",
    },
];

const FeaturesSection = ({navigateToCalculator}: FeaturesSectionProps) => {
    return (
        <section className="landing-section landing-applications" id="applications" aria-labelledby="applications-title">
            <div className="landing-container">
                <div className="landing-section__heading">
                    <p className="landing-section__index">02 / Applications</p>
                    <div>
                        <h2 id="applications-title">One measure, different objects.</h2>
                        <p>
                            NCD delegates feature discovery to the compressor. The method stays
                            fixed while the input domain changes.
                        </p>
                    </div>
                </div>

                <div className="application-list">
                    {applications.map((application) => (
                        <article className="application-row" key={application.type}>
                            <span className="application-row__index">{application.index}</span>
                            <div className="application-row__title">
                                <h3>{application.title}</h3>
                                <span>{application.format}</span>
                            </div>
                            <p>{application.description}</p>
                            <button
                                type="button"
                                className="landing-row-action"
                                onClick={() => navigateToCalculator(application.type)}
                            >
                                {application.action} <span aria-hidden="true">→</span>
                            </button>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;
