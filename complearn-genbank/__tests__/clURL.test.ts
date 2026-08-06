describe("URL validation", () => {
    test("rejects a semicolon as an absolute URL", () => {
        expect(() => new URL(";")).toThrow("Invalid URL");
    });
});
