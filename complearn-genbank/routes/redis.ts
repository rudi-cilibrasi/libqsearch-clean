import { createClient } from "redis";
import express from "express";
import logger from "../configurations/logger";
import ENV_LOADER from "../configurations/envLoader";

const router = express.Router();
const client = createClient({
    url: ENV_LOADER.REDIS_URL,
    password: ENV_LOADER.REDIS_PASSWORD
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

router.post("/get", async (req, res) => {
    try {
        const { key } = req.body;
        const value = await client.get(key);
        res.json({ value });
    } catch (error) {
        logger.error('Redis get error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
});


router.post("/set", async (req, res) => {
    try {
        const { key, value, ttl } = req.body;
        if (ttl) {
            await client.setEx(key, ttl, value);
        } else {
            await client.set(key, value);
        }
        res.json({ success: true });
    } catch (error) {
        logger.error('Redis set error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
});


router.post("/incr", async (req, res) => {
    try {
        const { key } = req.body;
        const value = await client.incr(key);
        res.json({ value });
    } catch (error) {
        logger.error('Redis increment error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
});


router.post("/del", async (req, res) => {
    try {
        const { key } = req.body;
        await client.del(key);
        res.json({ success: true });
    } catch (error) {
        logger.error('Redis delete error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
});

export default router;