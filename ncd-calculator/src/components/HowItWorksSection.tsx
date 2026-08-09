const stages = [
    {
        index: "1",
        title: "Represent",
        description: "Read each object as a finite byte sequence. No domain-specific embedding is introduced.",
        notation: "x₁, x₂, …, xₙ",
    },
    {
        index: "2",
        title: "Compress",
        description: "Measure compressed lengths for every object and pairwise concatenation.",
        notation: "C(xᵢ), C(xᵢxⱼ)",
    },
    {
        index: "3",
        title: "Normalize",
        description: "Correct for object size to produce a comparable, dimensionless distance.",
        notation: "Dᵢⱼ = NCD(xᵢ, xⱼ)",
    },
    {
        index: "4",
        title: "Structure",
        description: "Inspect the matrix directly or pass it to QSearch and K-grid optimization.",
        notation: "D → tree / grid",
    },
];

const HowItWorksSection = () => {
    return (
        <section className="landing-section landing-method" id="method" aria-labelledby="method-title">
            <div className="landing-container landing-method__grid">
                <div className="landing-method__introduction">
                    <p className="landing-section__index">03 / Method</p>
                    <h2 id="method-title">From raw objects to a geometry of information.</h2>
                    <p>
                        The pipeline is deliberately small. Its main modeling decision is the
                        compressor. LZMA and Zstandard provide large-window defaults; gzip and
                        Brotli make sensitivity to a classical and a modern coding model explicit.
                    </p>
                    <pre className="method-trace" aria-label="NCD processing pipeline">
{`object xᵢ ─┐
           ├─ compressor ─ C(xᵢxⱼ) ─ normalize ─ Dᵢⱼ
object xⱼ ─┘`}
                    </pre>
                </div>
                <ol className="method-stages">
                    {stages.map((stage) => (
                        <li key={stage.index}>
                            <span className="method-stage__index">{stage.index}</span>
                            <div>
                                <h3>{stage.title}</h3>
                                <p>{stage.description}</p>
                            </div>
                            <code>{stage.notation}</code>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
};

export default HowItWorksSection;
