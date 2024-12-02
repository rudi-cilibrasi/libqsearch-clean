const redis = require('redis');
const express = require('express');
const {error, info} = require("../configurations/logger");

const router = express.Router();
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || 'complearn'
});

client.connect().catch(error);

info('Redis routes being registered');

router.post("/get", async (req, res) => {
    try {
        const { key } = req.body;
        const value = await client.get(key);
        res.json({ value });
    } catch (error) {
        error('Redis get error:', error);
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
        error('Redis set error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
});


router.post("/incr", async (req, res) => {
    try {
        const { key } = req.body;
        const value = await client.incr(key);
        res.json({ value });
    } catch (error) {
        error('Redis increment error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
});


router.post("/del", async (req, res) => {
    try {
        const { key } = req.body;
        await client.del(key);
        res.json({ success: true });
    } catch (error) {
        error('Redis delete error:', error);
        res.status(500).json({ error: 'Redis operation failed' });
    }
});

module.exports = router;