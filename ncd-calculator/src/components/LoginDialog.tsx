import {useEffect, useRef} from "react";
import {BACKEND_BASE_URL} from "../configs/api";

interface LoginDialogProps {
    open: boolean;
    onClose: () => void;
}

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
].join(",");

const storeCurrentUrl = (): void => {
    if (!window.location.pathname.includes("error")) {
        sessionStorage.setItem("redirectUrl", window.location.pathname + window.location.search);
    }
};

export const LoginDialog = ({open, onClose}: LoginDialogProps): JSX.Element | null => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;

        const applicationShell = document.getElementById("application-shell");
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const shellWasInert = applicationShell?.hasAttribute("inert") ?? false;
        const previousBodyOverflow = document.body.style.overflow;

        applicationShell?.setAttribute("inert", "");
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus({preventScroll: true});

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
                return;
            }

            if (event.key !== "Tab" || !dialogRef.current) return;

            const focusableElements = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).filter((element) => !element.hasAttribute("disabled"));

            if (focusableElements.length === 0) {
                event.preventDefault();
                dialogRef.current.focus();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousBodyOverflow;

            if (!shellWasInert) applicationShell?.removeAttribute("inert");
            previouslyFocused?.focus({preventScroll: true});
        };
    }, [open]);

    if (!open) return null;

    const startLogin = (provider: "google" | "github"): void => {
        storeCurrentUrl();
        window.location.assign(`${BACKEND_BASE_URL}/auth/${provider}`);
    };

    return (
        <div className="login-overlay" onClick={onClose}>
            <div
                ref={dialogRef}
                className="login-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-title"
                aria-describedby="login-description"
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="login-dialog__header">
                    <div>
                        <span className="login-dialog__label">Research account</span>
                        <h2 id="login-title">Sign in to continue</h2>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close sign-in dialog"
                    >
                        ×
                    </button>
                </div>
                <p id="login-description">
                    Authentication is used to preserve account-specific workbench data.
                </p>
                <div className="login-dialog__actions">
                    <button type="button" onClick={() => startLogin("google")}>Continue with Google</button>
                    <button type="button" onClick={() => startLogin("github")}>Continue with GitHub</button>
                </div>
            </div>
        </div>
    );
};
