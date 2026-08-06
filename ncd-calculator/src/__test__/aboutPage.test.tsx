import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, test, vi} from "vitest";
import AboutPage from "../components/AboutPage";

vi.mock("../functions/user", () => ({
    getLoginUser: vi.fn().mockResolvedValue(null),
}));

describe("scientific About page", () => {
    test("uses the shared identity and presents the method and contributors", async () => {
        render(
            <MemoryRouter initialEntries={["/about"]}>
                <AboutPage
                    openLogin={false}
                    setOpenLogin={vi.fn()}
                    setAuthenticated={vi.fn()}
                />
            </MemoryRouter>
        );

        expect(screen.getByText("C(x,y)")).toBeInTheDocument();
        expect(screen.getByRole("heading", {name: "Compression as a scientific instrument."})).toBeInTheDocument();
        expect(screen.getByLabelText("Normalized compression distance equation")).toBeInTheDocument();
        expect(screen.getByRole("heading", {name: "Research and engineering contributors."})).toBeInTheDocument();
        expect(screen.getByRole("link", {name: /Rudi Cilibrasi/})).toHaveAttribute("href", "https://cilibrar.com/");
        expect(screen.getByRole("link", {name: "Open workbench"})).toHaveAttribute("href", "/calculator?searchMode=file_upload");
        expect(await screen.findByText(/Open research software/)).toBeInTheDocument();
    });
});
