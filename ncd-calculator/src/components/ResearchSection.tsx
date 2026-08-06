const ResearchSection = () => {
    return (
        <section className="landing-section landing-research" id="research" aria-labelledby="research-title">
            <div className="landing-container landing-research__grid">
                <div>
                    <p className="landing-section__index">05 / Research basis</p>
                    <h2 id="research-title">Built from a precise theoretical idea.</h2>
                </div>
                <div className="research-citation">
                    <p className="research-citation__quote">
                        Similar objects should admit a shorter joint description than unrelated objects.
                    </p>
                    <p>
                        The workbench follows the compression-based clustering framework introduced
                        by Rudi Cilibrasi and Paul M. B. Vitányi. Practical NCD approximates an ideal
                        information distance using a real compressor, so compressor behavior and
                        input size remain part of the experimental interpretation.
                    </p>
                    <div className="research-citation__source">
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
    );
};

export default ResearchSection;
