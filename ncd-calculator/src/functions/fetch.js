export const getApiResponseText = async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    return await response.text();
}