const express = require('express');
const axios = require('axios');
const router = express.Router();

// /api/language/fetch?file=frn.pdf
router.get("/fetch", async (req, res) => {
    const queryParams = req.query;

    const fileName = (queryParams && queryParams.file) || "eng.pdf";

    try {
        const response = await axios.get(
            `https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/${fileName}`,
            {
                responseType: 'stream',
            }
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');

        response.data.pipe(res);
    } catch (error) {
        console.error('Error fetching or returning the PDF:', error.message);
        res.status(500).send('Failed to fetch and return the PDF.');
    }
});

module.exports = router;