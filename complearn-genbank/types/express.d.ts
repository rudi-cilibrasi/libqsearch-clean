export {}

declare global {
    namespace Express {
        export interface Request {
            requestId?: string;
        }
    }
}
