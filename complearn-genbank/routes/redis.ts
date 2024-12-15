import { createClient } from "redis";
import express, {Request, RequestHandler, Response, Router} from "express";
import logger from "../configurations/logger";
import ENV_LOADER from "../configurations/envLoader";

const router: Router = express.Router();
const client = createClient({
    url: ENV_LOADER.REDIS_URL,
    password: ENV_LOADER.REDIS_PASSWORD,
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
const setHandler: RequestHandler<{}, any, RedisSetRequest> = async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
            res.status(400).json({ error: 'Key and value are required' });
            return;
        }

        const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
        await client.set(key, stringValue);
        res.json({ success: true });
    } catch (error) {
        console.error('Redis set error:', error);
        res.status(500).json({
            error: 'Redis operation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

const getHandler: RequestHandler<{}, any, RedisGetRequest> = async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) {
            res.status(400).json({ error: 'Key is required' });
            return;
        }

        const value = await client.get(key);
        try {
            const parsedValue = value ? JSON.parse(value) : null;
            res.json({ value: parsedValue });
        } catch {
            res.json({ value });
        }
    } catch (error) {
        console.error('Redis get error:', error);
        res.status(500).json({
            error: 'Redis operation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

const incrHandler: RequestHandler<{}, any, RedisIncrRequest> = async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) {
            res.status(400).json({ error: 'Key is required' });
            return;
        }

        const value = await client.incr(key);
        res.json({ value });
    } catch (error) {
        logger.error('Redis increment error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
};

const delHandler: RequestHandler<{}, any, RedisDelRequest> = async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) {
            res.status(400).json({ error: 'Key is required' });
            return;
        }

        await client.del(key);
        res.json({ success: true });
    } catch (error) {
        logger.error('Redis delete error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
};

// Register routes
router.post("/set", setHandler);
router.post("/get", getHandler);
router.post("/incr", incrHandler);
router.post("/del", delHandler);

export default router;
