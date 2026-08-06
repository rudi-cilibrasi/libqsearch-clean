const outputs = [
    {
        index: "A",
        title: "Distance matrix",
        description: "The primary numerical result. Audit individual pairwise values before interpreting a derived layout.",
        note: "exact pairwise scores",
    },
    {
        index: "B",
        title: "Quartet tree",
        description: "QSearch searches for a tree that preserves the quartet relationships implied by the matrix.",
        note: "global relational structure",
    },
    {
        index: "C",
        title: "K-grid",
        description: "A toroidal grid places low-distance objects near one another through simulated annealing.",
        note: "local neighborhood structure",
    },
];

const VisualizationTypesSection = () => {
    return (
        <section className="landing-section landing-outputs" id="outputs" aria-labelledby="outputs-title">
            <div className="landing-container">
                <div className="landing-section__heading">
                    <p className="landing-section__index">04 / Output</p>
                    <div>
                        <h2 id="outputs-title">Inspect the evidence at more than one scale.</h2>
                        <p>
                            The matrix is the measurement. Trees and grids are interpretations of
                            that measurement, useful for different structural questions.
                        </p>
                    </div>
                </div>
                <div className="output-grid">
                    {outputs.map((output) => (
                        <article key={output.index}>
                            <span className="output-grid__index">{output.index}</span>
                            <h3>{output.title}</h3>
                            <p>{output.description}</p>
                            <span className="output-grid__note">Use for: {output.note}</span>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default VisualizationTypesSection;
