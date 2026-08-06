import type {AnalysisType} from "./LandingPage";

interface HeroSectionProps {
    navigateToCalculator: (analysisType: AnalysisType) => void;
}

const exampleMatrix = [
    ["0.00", "0.18", "0.72", "0.76"],
    ["0.18", "0.00", "0.69", "0.73"],
    ["0.72", "0.69", "0.00", "0.21"],
    ["0.76", "0.73", "0.21", "0.00"],
];

const labels = ["A", "B", "C", "D"];

const HeroSection = ({navigateToCalculator}: HeroSectionProps) => {
    return (
        <section className="landing-hero" aria-labelledby="landing-title">
            <div className="landing-container landing-hero__grid">
                <div className="landing-hero__copy">
                    <p className="landing-kicker">Algorithmic information theory · research workbench</p>
                    <h1 id="landing-title">Measure similarity without choosing features.</h1>
                    <p className="landing-hero__lead">
                        Normalized Compression Distance compares objects through the information
                        they share. Supply sequences, texts, or files; the workbench returns a
                        pairwise distance matrix and structural views of the result.
                    </p>
                    <div className="landing-actions" aria-label="Primary actions">
                        <button
                            type="button"
                            className="landing-button landing-button--primary"
                            onClick={() => navigateToCalculator("fasta")}
                        >
                            Open the workbench
                        </button>
                        <a className="landing-text-link" href="#method">Read the method</a>
                    </div>
                    <dl className="landing-facts">
                        <div>
                            <dt>Input</dt>
                            <dd>Any finite byte sequence</dd>
                        </div>
                        <div>
                            <dt>Metric</dt>
                            <dd>Pairwise, feature-free</dd>
                        </div>
                        <div>
                            <dt>Runtime</dt>
                            <dd>Browser + WebAssembly</dd>
                        </div>
                    </dl>
                </div>

                <figure className="ncd-figure" aria-labelledby="ncd-figure-title">
                    <div className="ncd-figure__header">
                        <span>Figure 01</span>
                        <span>Normalized compression distance</span>
                    </div>
                    <div className="ncd-equation" id="ncd-figure-title">
                        <span className="ncd-equation__name">NCD(x, y)</span>
                        <span className="ncd-equation__equals">=</span>
                        <span className="ncd-fraction">
                            <span>C(xy) − min&#123;C(x), C(y)&#125;</span>
                            <span>max&#123;C(x), C(y)&#125;</span>
                        </span>
                    </div>
                    <div className="ncd-definition">
                        <span>C(x)</span>
                        <span>compressed length of object x</span>
                        <span>C(xy)</span>
                        <span>compressed length of their concatenation</span>
                    </div>
                    <div className="matrix-block">
                        <div className="matrix-block__label">Example distance matrix D</div>
                        <table className="matrix-table">
                            <caption>Example symmetric NCD matrix for four objects</caption>
                            <thead>
                                <tr>
                                    <th scope="col">D</th>
                                    {labels.map((label) => <th scope="col" key={label}>{label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {exampleMatrix.map((row, rowIndex) => (
                                    <tr key={labels[rowIndex]}>
                                        <th scope="row">{labels[rowIndex]}</th>
                                        {row.map((value, columnIndex) => (
                                            <td
                                                key={`${rowIndex}-${columnIndex}`}
                                                className={rowIndex === columnIndex ? "matrix-table__diagonal" : ""}
                                            >
                                                {value}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <figcaption>
                        Lower values indicate that the compressor finds more shared structure.
                        The matrix is symmetric; the diagonal is zero by definition.
                    </figcaption>
                </figure>
            </div>
        </section>
    );
};

export default HeroSection;
