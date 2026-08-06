import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router-dom";
import {describe, expect, test, vi} from "vitest";
import {LandingPage} from "../components/LandingPage";

vi.mock("../functions/user", () => ({
    getLoginUser: vi.fn().mockResolvedValue(null),
}));

const LocationProbe = () => {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}{location.search}</output>;
};

const renderLandingPage = () => {
    const setOpenLogin = vi.fn();
    const setAuthenticated = vi.fn();

    render(
        <MemoryRouter initialEntries={["/"]}>
            <LandingPage
                openLogin={false}
                setOpenLogin={setOpenLogin}
                setAuthenticated={setAuthenticated}
            />
            <LocationProbe/>
        </MemoryRouter>
    );

    return {setOpenLogin, setAuthenticated};
};

describe("scientific landing page", () => {
    test("presents the NCD method and research context", async () => {
        renderLandingPage();

        await screen.findByRole("button", {name: "Sign in"});

        expect(screen.getByText("C(x,y)")).toBeInTheDocument();
        expect(screen.getByRole("heading", {name: "Measure similarity without choosing features."})).toBeInTheDocument();
        expect(screen.getByText("NCD(x, y)")).toBeInTheDocument();
        expect(screen.getByRole("table", {name: "Example symmetric NCD matrix for four objects"})).toBeInTheDocument();
        expect(screen.getByRole("heading", {name: "Built from a precise theoretical idea."})).toBeInTheDocument();
    });

    test("opens the selected analysis workflow without a page reload", async () => {
        renderLandingPage();

        await screen.findByRole("button", {name: "Sign in"});

        fireEvent.click(screen.getByRole("button", {name: "Use local files"}));

        expect(screen.getByTestId("location")).toHaveTextContent("/calculator?searchMode=file_upload");
    });

    test("exposes sign-in through an accessible header action", async () => {
        const {setOpenLogin, setAuthenticated} = renderLandingPage();

        const signIn = await screen.findByRole("button", {name: "Sign in"});
        fireEvent.click(signIn);

        expect(setOpenLogin).toHaveBeenCalledWith(true);
        await waitFor(() => expect(setAuthenticated).toHaveBeenCalledWith(false));
    });
});
