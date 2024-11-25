const express = require('express');
const axios = require('axios');
const router = express.Router();
const envLoader = require('../configurations/envLoader');

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

const commonHandler = async (urlBase, req, res) => {
    // encoded queryParams from front-end reaches here will be decoded
    const queryParams = req.query;

    if (!queryParams) {
        return res.status(400).json({error: 'Missing query parameters'});
    }

    let queryString = '';
    let userApiKey = null;
    for (const [key, value] of Object.entries(queryParams)) {
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
    const finalUrl = `${urlBase}?${queryString}&${nextApiKey}`

    try {
        const response = await axios.get(finalUrl);
        res.send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Error fetching data from NCBI'});
    }
}

const forward = async (request, res) => {
    const requestUri = request.query.uri;
    try {
        const response = await axios.get(requestUri);
        res.send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Error fetching data from NCBI'});
    }
}

router.get("/fetch", (req, res) => commonHandler("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi", req, res));
router.get("/search", (req, res) => commonHandler("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", req, res));
router.get("/forward", (req, res) => forward(req, res));

module.exports = router;