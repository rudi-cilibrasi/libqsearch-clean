import {NextFunction, Request} from "express";
import {requestLogger} from "../middleware/requestLogger";

jest.mock("../configurations/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe("requestLogger", () => {
    it("assigns the same request ID to the request and response header", () => {
        const request = {
            method: "GET",
            originalUrl: "/health",
            headers: {},
            body: undefined,
            query: {},
            params: {},
        } as Request;
        const responseHeaders: Record<string, string> = {};
        const response = {
            statusCode: 200,
            statusMessage: "OK",
            locals: {},
            send: jest.fn(),
            json: jest.fn(),
            end: jest.fn(),
            setHeader: jest.fn((name: string, value: string) => {
                responseHeaders[name] = value;
            }),
            getHeaders: jest.fn(() => responseHeaders),
        };
        const next = jest.fn() as NextFunction;

        requestLogger(request, response, next);

        expect(request.requestId).toMatch(/^req_[0-9a-f]{8}$/);
        expect(responseHeaders["X-Request-ID"]).toBe(request.requestId);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
