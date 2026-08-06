import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {QSearchTree3D, QTreeResponse} from "../components/QSearchTree3D";

vi.mock("@react-three/fiber", () => ({
    Canvas: () => <div data-testid="spatial-tree-canvas"/>,
    useThree: vi.fn(),
}));

vi.mock("@react-three/drei", () => ({
    Html: ({children}: React.PropsWithChildren) => <>{children}</>,
    OrbitControls: () => null,
}));

vi.mock("../components/DotGraphVisualizer", () => ({
    DotGraphVisualizer: () => <div data-testid="planar-tree-canvas"/>,
}));

vi.mock("file-saver", () => ({saveAs: vi.fn()}));

const TREE: QTreeResponse = {
    nodes: [
        {index: 0, label: "English", connections: [2]},
        {index: 1, label: "French", connections: [2]},
        {index: 2, label: "", connections: [0, 1]},
    ],
};

describe("quartet tree controls", () => {
    beforeEach(() => vi.clearAllMocks());

    test("opens in the readable planar view and keeps 3D exploration optional", () => {
        render(<QSearchTree3D data={TREE}/>);

        expect(screen.getByRole("button", {name: "Planar 2D"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("planar-tree-canvas")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Interactive 3D"}));

        expect(screen.getByRole("button", {name: "Interactive 3D"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("spatial-tree-canvas")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Fit tree"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Reset view"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Zoom in"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Zoom out"})).toBeInTheDocument();
        expect(screen.getByText("Select a node to inspect it.")).toBeInTheDocument();
    });
});
