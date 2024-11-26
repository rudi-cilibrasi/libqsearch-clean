const express = require('express');
const axios = require('axios');
const router = express.Router();
const envLoader = require('../configurations/envLoader');
const logger = require('../configurations/logger');

let apiKeyIndex = 0;

const apiKeys = [
    envLoader.get('GENBANK_API_KEY_1'),
    envLoader.get('GENBANK_API_KEY_2'),
    envLoader.get('GENBANK_API_KEY_3'),
];

function getNextApiKey() {
    const apiKey = apiKeys[apiKeyIndex];
    apiKeyIndex = (apiKeyIndex + 1) % apiKeys.length;
    return apiKey;
}

router.post("/forward", async (req, res) => {
    const { externalUrl = "", method = "GET", body = null, responseType = "json", responseHeaders = {} } = req.body;

    if (!externalUrl) {
        return res.status(400).send({ error: 'Target URL is required' });
    }

    try {
        const parsedUrl = new URL(externalUrl);

        let queryString = '';
        let userApiKey = null;
        for (const [key, value] of parsedUrl.searchParams) {
            if (key.startsWith('api_key')) {
                userApiKey = key;
                continue;
            }
            if (queryString) {
                queryString += '&';
            }
            queryString += `${key}=${encodeURIComponent(value)}`;
        }

        let nextApiKey = userApiKey ? userApiKey : `api_key${encodeURIComponent(getNextApiKey())}`;
        const finalUrl = `${parsedUrl.origin}${parsedUrl.pathname}?${queryString}&${nextApiKey}`

        Object.entries(responseHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        const response = await axios({
            url: finalUrl,
            method: method,
            data: body,
            responseType: responseType
        });

        res.status(response.status);
        if (responseType === 'stream') {
            response.data.pipe(res);
        } else {
            res.send(response.data);
        }

    } catch (error) {
        logger.error('Error forwarding request:', error);
        res.status(500).send({ error: 'Failed to forward request', details: error.message });
    }

});

module.exports = router;