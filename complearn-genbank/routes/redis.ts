import { createClient } from "redis";
import express, { Request, Response, Router } from "express";
import logger from "../configurations/logger.js";
import ENV_LOADER from "../configurations/envLoader.js";

const router: Router = express.Router();
const client = createClient({
    url: ENV_LOADER.REDIS_URL,
    password: process.env.VITE_REDIS_PASSWORD,
});

const connectToRedis = async () => {
    try {
        await client.connect();
        logger.info('Connected to Redis');
    } catch (err) {
        logger.error('Error connecting to Redis:', err);
    }
};

connectToRedis();

logger.info('Redis routes being registered');

interface RedisGetRequest {
    key: string;
}

interface RedisSetRequest {
    key: string;
    value: string | object;
}

interface RedisIncrRequest {
    key: string;
}

interface RedisDelRequest {
    key: string;
}

// Use Router type for route handlers
router.post(
    "/set",
    (req: Request<{}, any, RedisSetRequest>, res: Response) => {
        return new Promise<void>(async (resolve) => {
            try {
                const { key, value } = req.body;
                if (!key || value === undefined) {
                    res.status(400).json({ error: 'Key and value are required' });
                    return resolve();
                }

                const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
                await client.set(key, stringValue);
                res.json({ success: true });
                resolve();
            } catch (error) {
                console.error('Redis set error:', error);
                res.status(500).json({
                    error: 'Redis operation failed',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
                resolve();
            }
        });
    }
);

router.post(
    "/get",
    (req: Request<{}, any, RedisGetRequest>, res: Response) => {
        return new Promise<void>(async (resolve) => {
            try {
                const { key } = req.body;
                if (!key) {
                    res.status(400).json({ error: 'Key is required' });
                    return resolve();
                }

                const value = await client.get(key);
                try {
                    const parsedValue = value ? JSON.parse(value) : null;
                    res.json({ value: parsedValue });
                } catch {
                    res.json({ value });
                }
                resolve();
            } catch (error) {
                console.error('Redis get error:', error);
                res.status(500).json({
                    error: 'Redis operation failed',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
                resolve();
            }
        });
    }
);

router.post(
    "/incr",
    (req: Request<{}, any, RedisIncrRequest>, res: Response) => {
        return new Promise<void>(async (resolve) => {
            try {
                const { key } = req.body;
                if (!key) {
                    res.status(400).json({ error: 'Key is required' });
                    return resolve();
                }

                const value = await client.incr(key);
                res.json({ value });
                resolve();
            } catch (error) {
                logger.error('Redis increment error:', error);
                res.status(500).json({ error: 'Redis operation failed' });
                resolve();
            }
        });
    }
);

router.post(
    "/del",
    (req: Request<{}, any, RedisDelRequest>, res: Response) => {
        return new Promise<void>(async (resolve) => {
            try {
                const { key } = req.body;
                if (!key) {
                    res.status(400).json({ error: 'Key is required' });
                    return resolve();
                }

                await client.del(key);
                res.json({ success: true });
                resolve();
            } catch (error) {
                logger.error('Redis delete error:', error);
                res.status(500).json({ error: 'Redis operation failed' });
                resolve();
            }
        });
    }
);

export default router;
