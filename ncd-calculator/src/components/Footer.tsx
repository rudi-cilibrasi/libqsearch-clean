import {Link} from "react-router-dom";

const Footer = () => {
    return (
        <footer className="landing-footer">
            <div className="landing-container landing-footer__grid">
                <div>
                    <strong>CompLearn / NCD</strong>
                    <span>Compression-based similarity analysis</span>
                </div>
                <nav aria-label="Footer navigation">
                    <Link to="/about">About</Link>
                    <Link to="/#method">Method</Link>
                    <a href="https://github.com/rudi-cilibrasi/libqsearch-clean" target="_blank" rel="noopener noreferrer">Source</a>
                </nav>
                <span className="landing-footer__meta">Open research software · {new Date().getFullYear()}</span>
            </div>
        </footer>
    );
};

export default Footer;
