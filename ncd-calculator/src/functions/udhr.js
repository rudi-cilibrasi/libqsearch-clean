import * as pdfjsLib from 'pdfjs-dist';

import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.mjs';


const LANGUAGE_URLS = {
    // Major UN Languages
    'eng': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/eng.pdf', // English
    'fra': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/frn.pdf', // French
    'rus': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/rus.pdf', // Russian
    'spa': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/spn.pdf', // Spanish
    'cmn': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/chn.pdf', // Chinese (Mandarin)

    // Other Major Languages
    'hin': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/hnd.pdf', // Hindi
    'ben': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/bng.pdf', // Bengali
    'por': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/por.pdf', // Portuguese
    'jpn': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/jpn.pdf', // Japanese
    'deu': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/ger.pdf', // German
    'jav': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/jan.pdf', // Javanese
    'kor': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/kkn.pdf', // Korean
    'vie': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/vie.pdf', // Vietnamese
    'mar': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/mrt.pdf', // Marathi
    'tam': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/tam.pdf', // Tamil
    'tur': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/trk.pdf', // Turkish
    'ita': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/itn.pdf', // Italian
    'tha': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/thj.pdf', // Thai

    // European Languages
    'bul': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/blg.pdf', // Bulgarian
    'ces': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/czc.pdf', // Czech
    'dan': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/dns.pdf', // Danish
    'nld': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/dut.pdf', // Dutch
    'est': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/est.pdf', // Estonian
    'ell': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/grk.pdf', // Greek
    'hun': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/hng.pdf', // Hungarian
    'isl': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/ice.pdf', // Icelandic
    'gle': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/gli1.pdf', // Irish
    'lav': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/lat.pdf', // Latvian
    'lit': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/lit.pdf', // Lithuanian
    'nor': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/nrr.pdf', // Norwegian
    'pol': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/pql.pdf', // Polish
    'ron': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/rum.pdf', // Romanian
    'slk': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/slo.pdf', // Slovak
    'slv': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/slv.pdf', // Slovenian
    'swe': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/swd.pdf', // Swedish

    // Asian Languages
    'hye': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/arm.pdf', // Armenian
    'kat': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/geo.pdf', // Georgian
    'kaz': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/kaz.pdf', // Kazakh
    'kir': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/kdo.pdf', // Kyrgyz
    'mon': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/khk.pdf', // Mongolian
    'tgk': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/pet.pdf', // Tajik
    'tuk': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/tck.pdf', // Turkmen
    'uzb': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/uzb.pdf', // Uzbek

    // African Languages
    'amh': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/amh.pdf', // Amharic
    'hau': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/hau.pdf', // Hausa
    'ibo': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/igr.pdf', // Igbo
    'yor': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/yor.pdf', // Yoruba
    'zul': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/zuu.pdf', // Zulu
    'swa': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/swa.pdf', // Swahili

    // Middle Eastern Languages
    'fas': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/prs.pdf', // Persian
    'heb': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/hbr.pdf', // Hebrew
    'kur': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/kdb1.pdf', // Kurdish
    'urd': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/urd.pdf', // Urdu

    // Southeast Asian Languages
    'khm': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/khm.pdf', // Khmer
    'lao': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/nol.pdf', // Lao
    'mya': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/bms.pdf', // Burmese
    'ind': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/inz.pdf', // Indonesian
    'msa': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/mli.pdf', // Malay
    'fil': 'https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/tgl.pdf', // Filipino
};

const LANGUAGE_NAMES = {
    'eng': 'English',
    'fra': 'French',
    'rus': 'Russian',
    'spa': 'Spanish',
    'cmn': 'Chinese (Mandarin)',
    'hin': 'Hindi',
    'ben': 'Bengali',
    'por': 'Portuguese',
    'jpn': 'Japanese',
    'deu': 'German',
    'jav': 'Javanese',
    'kor': 'Korean',
    'vie': 'Vietnamese',
    'mar': 'Marathi',
    'tam': 'Tamil',
    'tur': 'Turkish',
    'ita': 'Italian',
    'tha': 'Thai',
    'bul': 'Bulgarian',
    'ces': 'Czech',
    'dan': 'Danish',
    'nld': 'Dutch',
    'est': 'Estonian',
    'ell': 'Greek',
    'hun': 'Hungarian',
    'isl': 'Icelandic',
    'gle': 'Irish',
    'lav': 'Latvian',
    'lit': 'Lithuanian',
    'nor': 'Norwegian',
    'pol': 'Polish',
    'ron': 'Romanian',
    'slk': 'Slovak',
    'slv': 'Slovenian',
    'swe': 'Swedish',
    'hye': 'Armenian',
    'kat': 'Georgian',
    'kaz': 'Kazakh',
    'kir': 'Kyrgyz',
    'mon': 'Mongolian',
    'tgk': 'Tajik',
    'tuk': 'Turkmen',
    'uzb': 'Uzbek',
    'amh': 'Amharic',
    'hau': 'Hausa',
    'ibo': 'Igbo',
    'yor': 'Yoruba',
    'zul': 'Zulu',
    'swa': 'Swahili',
    'fas': 'Persian',
    'heb': 'Hebrew',
    'kur': 'Kurdish',
    'urd': 'Urdu',
    'khm': 'Khmer',
    'lao': 'Lao',
    'mya': 'Burmese',
    'ind': 'Indonesian',
    'msa': 'Malay',
    'fil': 'Filipino'
};


const PROXY_URL = "https://namvdogithubio.vercel.app/api/proxy";

const LANGUAGE_ENCODINGS = {
    // East Asian
    'cmn': 'gb18030',     // Chinese
    'jpn': 'shift-jis',   // Japanese
    'kor': 'euc-kr',      // Korean

    // South Asian
    'hin': 'utf-8',       // Hindi
    'ben': 'utf-8',       // Bengali
    'tel': 'utf-8',       // Telugu
    'mar': 'utf-8',       // Marathi
    'tam': 'utf-16',       // Tamil

    // Middle Eastern & Arabic Script
    'ara': 'windows-1256', // Arabic
    'fas': 'windows-1256', // Persian
    'urd': 'windows-1256', // Urdu

    // Cyrillic Script
    'rus': 'utf-8', // Russian
    'ukr': 'windows-1251', // Ukrainian
    'bel': 'windows-1251', // Belarusian
    'bul': 'utf-8', // Bulgarian

    // Greek
    'ell': 'utf-8', // Greek

    // Hebrew
    'heb': 'windows-1255', // Hebrew

    // Thai
    'tha': 'tis-620',     // Thai

    // Vietnamese
    'vie': 'windows-1258', // Vietnamese

    // Baltic languages
    'est': 'utf-8', // Estonian
    'lat': 'windows-1257', // Latvian
    'lit': 'windows-1257', // Lithuanian

    // Central/Eastern European
    'ces': 'utf-8', // Czech
    'hun': 'utf-8', // Hungarian
    'pol': 'windows-1250', // Polish
    'ron': 'windows-1250', // Romanian
    'slk': 'windows-1250', // Slovak
    'slv': 'windows-1250', // Slovenian

    'default': 'utf-8'
};

async function decodeText(pdfDoc, language) {
    const encoding = LANGUAGE_ENCODINGS[language] || LANGUAGE_ENCODINGS.default;
    let extractedText = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        let pageText = '';

        if (typeof textContent === 'string') {
            pageText = textContent;
        } else if (Array.isArray(textContent?.items)) {
            pageText = textContent.items
                .map(item => item.str || '')
                .join('');
        }
        const textEncoder = new TextEncoder();
        try {
            const bytes = textEncoder.encode(pageText);
            let decoder;
            try {
                decoder = new TextDecoder(encoding, {fatal: true});
            } catch (e) {
                console.warn(`Encoding ${encoding} not supported, falling back to UTF-8`);
                decoder = new TextDecoder('utf-8', {fatal: false});
            }
            const decodedText = decoder.decode(bytes);
            const normalizedText = decodedText.normalize('NFKC');
            extractedText += normalizedText;

        } catch (error) {
            console.warn(`Error decoding text on page ${pageNum}:`, error);
            const fallbackEncodings = ['utf-8', 'windows-1252', 'iso-8859-1'];
            let decoded = false;

            for (const fallbackEncoding of fallbackEncodings) {
                try {
                    const fallbackDecoder = new TextDecoder(fallbackEncoding, {fatal: false});
                    const bytes = textEncoder.encode(pageText);
                    const fallbackText = fallbackDecoder.decode(bytes);
                    extractedText += fallbackText;
                    decoded = true;
                    console.warn(`Successfully decoded using fallback encoding: ${fallbackEncoding}`);
                    break;
                } catch (fallbackError) {
                    continue;
                }
            }
            if (!decoded) {
                extractedText += pageText;
                console.warn('All decoding attempts failed, using original text');
            }
        }
    }
    return extractedText;
}


export const getTranslationResponse = async (language) => {
    if (!LANGUAGE_URLS[language]) {
        throw new Error(`No URL found for ${language}`);
    }
    const uri = PROXY_URL + "?url=" + LANGUAGE_URLS[language] + "&contentType=application/pdf";
    const response = await fetch(uri);
    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }
    const pdfData = await response.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({data: pdfData}).promise;
    return decodeText(pdfDoc, language);
}


export {LANGUAGE_URLS, LANGUAGE_NAMES};