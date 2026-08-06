import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {DotGraphVisualizer} from "../components/DotGraphVisualizer";

const {loadGraphvizMock} = vi.hoisted(() => ({
    loadGraphvizMock: vi.fn(),
}));

vi.mock("../services/GraphvizService", () => ({
    loadGraphviz: loadGraphvizMock,
}));

const TREE = {
    nodes: [
        {index: 0, label: "English", connections: [2]},
        {index: 1, label: "French", connections: [2]},
        {index: 2, label: "", connections: [0, 1]},
    ],
};

describe("planar tree renderer recovery", () => {
    beforeEach(() => {
        loadGraphvizMock.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    test("offers a retry and initializes the renderer again after a load failure", async () => {
        loadGraphvizMock
            .mockRejectedValueOnce(new Error("module unavailable"))
            .mockRejectedValueOnce(new Error("module still unavailable"));

        render(<DotGraphVisualizer data={TREE}/>);

        expect(await screen.findByRole("alert")).toHaveTextContent("module unavailable");
        fireEvent.click(screen.getByRole("button", {name: "Retry renderer"}));

        await waitFor(() => expect(loadGraphvizMock).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole("alert")).toHaveTextContent("module still unavailable");
    });
});
