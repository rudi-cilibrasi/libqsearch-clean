import { PDFDocument } from 'pdf-lib';

export const config = {
    api: {
        bodyParser: false,
    },
};

const isPDFValid = async (arrayBuffer) => {
    try {
        const firstBytes = new Uint8Array(arrayBuffer.slice(0, 5));
        const header = new TextDecoder().decode(firstBytes);
        if (!header.startsWith('%PDF-')) {
            return false;
        }

        await PDFDocument.load(arrayBuffer, {
            ignoreEncryption: true,
            updateMetadata: false,
        });
        return true;
    } catch (error) {
        console.error('PDF validation error:', error);
        return false;
    }
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed' });
        return;
    }

    const { url, contentType = 'application/json' } = req.query;

    if (!url || url.trim() === '') {
        res.status(400).json({ message: 'The provided URL is not valid' });
        return;
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
        );

        switch (contentType) {
            case 'application/json':
                const jsonData = await response.text();
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(jsonData);
                break;

            case 'application/pdf':
                const pdfData = await response.arrayBuffer();

                const isValid = await isPDFValid(pdfData);
                if (!isValid) {
                    throw new Error('Invalid PDF format or corrupted data');
                }

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
                res.status(200).send(Buffer.from(pdfData));
                break;

            case 'text/html':
                const htmlData = await response.text();
                res.setHeader('Content-Type', 'text/html');
                res.status(200).send(htmlData);
                break;

            default:
                res.status(400).json({ message: `Unsupported content type: ${contentType}` });
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            message: 'Error fetching resource',
            error: error.message,
            type: error.name
        });
    }
}