import {StrictMode, useState} from "react";
import axe, {type AxeResults} from "axe-core";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, test, vi} from "vitest";
import {Link, MemoryRouter, Route, Routes} from "react-router-dom";
import {LandingPage} from "../components/LandingPage";
import {LoginDialog} from "../components/LoginDialog";
import {RouteAccessibility} from "../components/RouteAccessibility";

vi.mock("../functions/user", () => ({
    getLoginUser: vi.fn().mockResolvedValue(null),
}));

afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
    document.title = "";
});

const getViolationSummary = (results: AxeResults): string[] => results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
);

describe("accessibility foundations", () => {
    test("does not steal focus when Strict Mode repeats the initial route effect", () => {
        render(
            <StrictMode>
                <MemoryRouter>
                    <RouteAccessibility/>
                    <main id="main-content" tabIndex={-1}>Primary content</main>
                </MemoryRouter>
            </StrictMode>,
        );

        expect(document.body).toHaveFocus();
    });

    test("provides a bypass link that moves focus to the main content", () => {
        render(
            <MemoryRouter>
                <RouteAccessibility/>
                <main id="main-content" tabIndex={-1}>Primary content</main>
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole("link", {name: "Skip to main content"}));

        expect(screen.getByRole("main")).toHaveFocus();
        expect(window.location.hash).toBe("#main-content");
    });

    test("updates the page title and focuses main content after a client-side route change", async () => {
        render(
            <MemoryRouter initialEntries={["/"]}>
                <RouteAccessibility/>
                <Routes>
                    <Route
                        path="/"
                        element={(
                            <main id="main-content" tabIndex={-1}>
                                <Link to="/about">About CompLearn</Link>
                            </main>
                        )}
                    />
                    <Route
                        path="/about"
                        element={<main id="main-content" tabIndex={-1}>About content</main>}
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(document.title).toBe("CompLearn | Normalized Compression Distance");
        fireEvent.click(screen.getByRole("link", {name: "About CompLearn"}));

        await waitFor(() => expect(document.title).toBe("About | CompLearn"));
        expect(screen.getByRole("main")).toHaveFocus();
    });

    test("contains modal focus, closes with Escape, and restores the invoking control", () => {
        const DialogHarness = (): JSX.Element => {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <div id="application-shell">
                        <button type="button" onClick={() => setOpen(true)}>Sign in</button>
                    </div>
                    <LoginDialog open={open} onClose={() => setOpen(false)}/>
                </>
            );
        };

        render(<DialogHarness/>);
        const signInButton = screen.getByRole("button", {name: "Sign in"});
        signInButton.focus();
        fireEvent.click(signInButton);

        const applicationShell = document.getElementById("application-shell");
        const closeButton = screen.getByRole("button", {name: "Close sign-in dialog"});
        const githubButton = screen.getByRole("button", {name: "Continue with GitHub"});

        expect(screen.getByRole("dialog", {name: "Sign in to continue"})).toBeInTheDocument();
        expect(applicationShell).toHaveAttribute("inert");
        expect(document.body).toHaveStyle({overflow: "hidden"});
        expect(closeButton).toHaveFocus();

        fireEvent.keyDown(closeButton, {key: "Tab", shiftKey: true});
        expect(githubButton).toHaveFocus();
        fireEvent.keyDown(githubButton, {key: "Tab"});
        expect(closeButton).toHaveFocus();

        fireEvent.keyDown(closeButton, {key: "Escape"});
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(applicationShell).not.toHaveAttribute("inert");
        expect(signInButton).toHaveFocus();
    });

    test("has no automatically detectable WCAG A or AA violations on the landing route", async () => {
        const {container} = render(
            <MemoryRouter>
                <div id="application-shell">
                    <RouteAccessibility/>
                    <LandingPage
                        setOpenLogin={vi.fn()}
                        setAuthenticated={vi.fn()}
                    />
                </div>
            </MemoryRouter>,
        );

        await screen.findByRole("button", {name: "Sign in"});
        const results = await axe.run(container, {
            runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
            },
            rules: {
                "color-contrast": {enabled: false},
            },
        });

        expect(getViolationSummary(results)).toEqual([]);
    });
});
