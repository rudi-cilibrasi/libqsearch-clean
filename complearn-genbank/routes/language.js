require('dotenv').config();

const express = require('express');
const axios = require('axios');
const router = express.Router();

// http://localhost:3000/language/fetch?file=frn.pdf
router.get("/fetch", async (req, res) => {
    const queryParams = req.query;

    const fileName = (queryParams && queryParams.file) || "eng.pdf";

    try {
        const response = await axios.get(`https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/${fileName}`);
        res.send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Error fetching data from NCBI'});
    }
});

module.exports = router;