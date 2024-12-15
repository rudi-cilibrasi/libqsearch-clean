import axios from '../functions/fetchProxy.js';
import MockAdapter from "axios-mock-adapter";

const fetchData = async () => {
    try {
        const response = await axios.get('http://localhost:3001/data');
        return response.data;
    } catch (error) {
        console.log("Error", error);
    }
};

describe('axiosRetry Tests', () => {
    let mock: MockAdapter;
    beforeEach(() => {
        jest.clearAllMocks(); // Clear any previous mocks
        mock = new MockAdapter(axios);
    });

    it('should retry 3 times on failure and eventually succeed', async () => {

        mock.onGet().replyOnce(429, {})
        mock.onGet().replyOnce(429, {})
        mock.onGet().replyOnce(200, {data: "Successful"})
        const response = await fetchData();

        expect(response.data).toBe('Successful');
        expect(mock.history.get.length).toBe(3);

        // Optionally, you can also check the exact request URL and other details
        expect(mock.history.get[0].url).toBe('http://localhost:3001/data');
        expect(mock.history.get[1].url).toBe('http://localhost:3001/data');
        expect(mock.history.get[2].url).toBe('http://localhost:3001/data');

    }, 100000);

    it('should fail after 3 retries if all attempts fail', async () => {
        mock.onGet().replyOnce(429, {})
        mock.onGet().replyOnce(429, {})
        mock.onGet().replyOnce(429, {})
        await fetchData();

        expect(mock.history.get.length).toBe(4);

        // Optionally, you can also check the exact request URL and other details
        expect(mock.history.get[0].url).toBe('http://localhost:3001/data');
        expect(mock.history.get[1].url).toBe('http://localhost:3001/data');
        expect(mock.history.get[2].url).toBe('http://localhost:3001/data');
    }, 100000);

    it('should make a successful request and return the correct data', async () => {
        // Simulate a successful GET request with status 200
        mock.onGet().replyOnce(200, { data: 'Successful' });

        const data = await fetchData();  // Call the function under test

        // Verify that the correct response is returned
        expect(data.data).toBe('Successful');

        // Assert that axios.get was called exactly once
        expect(mock.history.get.length).toBe(1);
    });

    it('should handle multiple successful requests in sequence', async () => {
        // Simulate multiple successful GET requests
        mock.onGet().replyOnce(200, { data: 'First Success' });
        mock.onGet().replyOnce(200, { data: 'Second Success' });

        const data1 = await fetchData();  // First call
        const data2 = await fetchData();  // Second call

        // Verify that both responses are handled correctly
        expect(data1.data).toBe('First Success');
        expect(data2.data).toBe('Second Success');

        // Assert that axios.get was called twice
        expect(mock.history.get.length).toBe(2);
    });
});
