/**
 * Get theme-appropriate colors for the tree visualization
 */
export const getTreeColors = (theme: "light" | "dark") => {
    return {
        // Background colors
        background: theme === "dark" ? "#1a1a2e" : "#f0f2f5",
        fogColor: theme === "dark" ? "#1a1a2e" : "#f0f2f5",

        // Node colors
        leafNodeColor: theme === "dark" ? 0x4287f5 : 0x0047AB, // Blue
        internalNodeColor: theme === "dark" ? 0xAA336A : 0x800080, // Purple
        selectedNodeColor: 0xffcc00, // Yellow/gold for selected node
        hoveredNodeColor: 0xff6600, // Orange for hovered node
        highlightedNodeColor: theme === "dark" ? 0x221100 : 0x110000, // Subtle highlight for path nodes

        // Edge/spring colors
        springColor: theme === "dark" ? 0x555555 : 0xAAAAAA, // Gray
        highlightedSpringColor: theme === "dark" ? 0xff9900 : 0xff6600, // Orange/amber for highlighted springs

        // Text colors
        textColor: theme === "dark" ? "white" : "black",
        textOutlineColor: theme === "dark" ? "#000000" : "#ffffff",

        // Grid colors
        gridMainColor: theme === "dark" ? 0x333333 : 0xcccccc,
        gridSecondaryColor: theme === "dark" ? 0x222222 : 0xdddddd,

        // UI colors
        tooltipBg: theme === "dark" ? "bg-gray-800" : "bg-white",
        tooltipText: theme === "dark" ? "text-white" : "text-gray-800",
        panelBg: theme === "dark" ? "bg-gray-900 bg-opacity-80" : "bg-white bg-opacity-80",
        panelText: theme === "dark" ? "text-white" : "text-gray-800",

        // Light intensity
        ambientLightIntensity: theme === "dark" ? 0.6 : 0.7,
        directionalLightIntensity: theme === "dark" ? 0.8 : 0.7
    };
};
