import {useEffect, useState} from "react";
import axios from "axios";
import {BACKEND_BASE_URL} from "../configs/api";
import {getLoginUser} from "../functions/user";
import {Link} from "react-router-dom";
import {APP_BASE_URL, AUTH_ENABLED} from "../configs/site";
import "./LandingPage.css";

interface HeaderProps {
    openLogin: boolean;
    setOpenLogin: (open: boolean) => void;
    setAuthenticated: (authenticated: boolean) => void;
    isScrolled?: boolean;
    variant?: "landing" | "app";
}

const Header = ({
    openLogin,
    setOpenLogin,
    setAuthenticated,
    isScrolled = false,
    variant = "app",
}: HeaderProps) => {
    const [userName, setUserName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadSession = async (): Promise<void> => {
            if (!AUTH_ENABLED) {
                setAuthenticated(false);
                setIsLoading(false);
                return;
            }

            const authenticatedUser = await getLoginUser();
            if (!isMounted) return;

            setUserName(authenticatedUser);
            setAuthenticated(Boolean(authenticatedUser));
            setIsLoading(false);

            const redirectUrl = sessionStorage.getItem("redirectUrl");
            if (authenticatedUser && redirectUrl && redirectUrl !== window.location.pathname) {
                sessionStorage.removeItem("redirectUrl");
                window.location.assign(redirectUrl);
            }
        };

        void loadSession();
        return () => {
            isMounted = false;
        };
    }, [setAuthenticated]);

    useEffect(() => {
        if (!openLogin) return;

        const closeOnEscape = (event: KeyboardEvent): void => {
            if (event.key === "Escape") setOpenLogin(false);
        };

        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [openLogin, setOpenLogin]);

    const storeCurrentUrl = (): void => {
        if (!window.location.pathname.includes("error")) {
            sessionStorage.setItem("redirectUrl", window.location.pathname + window.location.search);
        }
    };

    const startLogin = (provider: "google" | "github"): void => {
        storeCurrentUrl();
        window.location.assign(`${BACKEND_BASE_URL}/auth/${provider}`);
    };

    const handleLogout = async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            await axios.get(`${BACKEND_BASE_URL}/auth/logout`, {withCredentials: true});
            setUserName(null);
            setAuthenticated(false);
            window.location.assign(APP_BASE_URL);
        } catch {
            setError("The session could not be closed. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <header className={`site-header ${isScrolled ? "site-header--scrolled" : ""}`}>
            <div className="landing-container site-header__inner">
                <Link className="site-identity" to="/" aria-label="CompLearn NCD home">
                    <span className="site-identity__mark" aria-hidden="true">C(x,y)</span>
                    <span className="site-identity__name">
                        <strong>CompLearn</strong>
                        <span>Normalized Compression Distance</span>
                    </span>
                </Link>

                <nav className="site-navigation" aria-label="Primary navigation">
                    {variant === "landing" ? (
                        <>
                            <a href="#applications">Applications</a>
                            <a href="#method">Method</a>
                            <a href="#research">Research</a>
                        </>
                    ) : (
                        <>
                            <Link to="/">Home</Link>
                            <Link to="/about">About</Link>
                        </>
                    )}
                </nav>

                <div className="site-session">
                    {!AUTH_ENABLED ? null : isLoading ? (
                        <span className="site-session__status" aria-live="polite">Checking session</span>
                    ) : userName ? (
                        <>
                            <span className="site-session__user">{userName}</span>
                            <button type="button" className="site-session__button" onClick={handleLogout}>Sign out</button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="site-session__button"
                            onClick={() => {
                                storeCurrentUrl();
                                setOpenLogin(true);
                            }}
                        >
                            Sign in
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="site-notice" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
                </div>
            )}

            {openLogin && (
                <div className="login-overlay" onMouseDown={() => setOpenLogin(false)}>
                    <div
                        className="login-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="login-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="login-dialog__header">
                            <div>
                                <span className="login-dialog__label">Research account</span>
                                <h2 id="login-title">Sign in to continue</h2>
                            </div>
                            <button type="button" onClick={() => setOpenLogin(false)} aria-label="Close sign-in dialog">×</button>
                        </div>
                        <p>Authentication is used to preserve account-specific workbench data.</p>
                        <div className="login-dialog__actions">
                            <button type="button" onClick={() => startLogin("google")}>Continue with Google</button>
                            <button type="button" onClick={() => startLogin("github")}>Continue with GitHub</button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
