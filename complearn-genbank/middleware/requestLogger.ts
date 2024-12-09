import logger from "../configurations/logger";
import crypto from 'crypto';
import {Request, Response, NextFunction} from 'express';
import {IncomingHttpHeaders, OutgoingHttpHeaders} from "http";

const generateRequestId = () => {
    return 'req_' + crypto.randomBytes(4).toString('hex');
}
const sanitizeHeaders = (headers: IncomingHttpHeaders | OutgoingHttpHeaders) => {
    const sanitized = { ...headers };
    const sensitiveFields = ['authorization', 'cookie', 'password', 'token', 'api_key'];
    Object.entries(sanitized).forEach(([key, value]) => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            sanitized[key] = '[REDACTED]';
        }
    });
    return sanitized;
};

const sanitizeUrl = (url: string) => {
    if (!url) return url;
    try {
        const urlObj = new URL(url);
        ['api_key', 'key', 'token', 'auth'].forEach(param => {
            if (urlObj.searchParams.has(param)) {
                urlObj.searchParams.set(param, '[REDACTED]');
            }
        });
        return urlObj.toString();
    } catch {
        return url;
    }
};

const handleResponseBody = (body: any, headers: OutgoingHttpHeaders) => {
    if (!body) return null;
    if (headers?.['content-type']?.includes('application/json')) {
        return typeof body === 'string' ? JSON.parse(body) : body;
    }
    if (Buffer.isBuffer(body)) return '[Binary Data]';
    if (headers?.['content-type']?.includes('text/html')) return '[HTML Content]';
    return body;
};

export const requestLogger = (req: Request, res: any, next: NextFunction) => {
    const requestId = generateRequestId();
    const startTime = process.hrtime();

    const transaction: any = {
        request: {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: sanitizeUrl(req.originalUrl),
            headers: sanitizeHeaders(req.headers),
            body: req.method !== 'GET' ? req.body : undefined,
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
            params: Object.keys(req.params).length > 0 ? req.params : undefined,
        }
    };

    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    res.send = function(...args: any[]) {
        completeTransaction(args[0]);
        return originalSend.call(this, ...args);
    };

    res.json = function(...args: any[]) {
        completeTransaction(args[0]);
        return originalJson.call(this, ...args);
    };

    res.end = function(...args: any[]) {
        completeTransaction(args[0]);
        return originalEnd.call(this, ...args);
    };

    const completeTransaction = (body: any) => {
        if (transaction.response) return;

        const diff = process.hrtime(startTime);
        const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

        transaction.response = {
            timestamp: new Date().toISOString(),
            status: res.statusCode,
            headers: sanitizeHeaders(res.getHeaders()),
            body: handleResponseBody(body, res.getHeaders()),
            duration: `${duration}ms`
        };

        if (res.statusCode >= 400) {
            transaction.error = {
                statusCode: res.statusCode,
                message: res.statusMessage,
                stack: res.locals.errorStack
            };
        }

        const level = res.statusCode >= 500 ? 'error' :
            res.statusCode >= 400 ? 'warn' :
                'info';

        // Log complete transaction
        logger[level]({
            message: `${transaction.request.method} ${transaction.request.url} ${transaction.response.status} ${transaction.response.duration}`,
            requestId,
            transaction
        });
    };

    res.setHeader('X-Request-ID', requestId);
    req.requestId = requestId;
    next();
};