import * as pdfjsLib from 'pdfjs-dist';

import * as pdfjs from "pdfjs-dist";
import {sendRequestToProxy} from "./fetchProxy.js";

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.mjs';


const LANGUAGE_URLS = {
  // Major UN Languages
  'eng': 'eng.pdf', // English
  'fra': 'frn.pdf', // French
  'rus': 'rus.pdf', // Russian
  'spa': 'spn.pdf', // Spanish
  'cmn': 'chn.pdf', // Chinese (Mandarin)

  // Other Major Languages
  'hin': 'hnd.pdf', // Hindi
  'ben': 'bng.pdf', // Bengali
  'por': 'por.pdf', // Portuguese
  'jpn': 'jpn.pdf', // Japanese
  'deu': 'ger.pdf', // German
  'jav': 'jan.pdf', // Javanese
  'kor': 'kkn.pdf', // Korean
  'vie': 'vie.pdf', // Vietnamese
  'mar': 'mrt.pdf', // Marathi
  'tam': 'tam.pdf', // Tamil
  'tur': 'trk.pdf', // Turkish
  'ita': 'itn.pdf', // Italian
  'tha': 'thj.pdf', // Thai

  // European Languages
  'bul': 'blg.pdf', // Bulgarian
  'ces': 'czc.pdf', // Czech
  'dan': 'dns.pdf', // Danish
  'nld': 'dut.pdf', // Dutch
  'est': 'est.pdf', // Estonian
  'ell': 'grk.pdf', // Greek
  'hun': 'hng.pdf', // Hungarian
  'isl': 'ice.pdf', // Icelandic
  'gle': 'gli1.pdf', // Irish
  'lav': 'lat.pdf', // Latvian
  'lit': 'lit.pdf', // Lithuanian
  'nor': 'nrr.pdf', // Norwegian
  'pol': 'pql.pdf', // Polish
  'ron': 'rum.pdf', // Romanian
  'slk': 'slo.pdf', // Slovak
  'slv': 'slv.pdf', // Slovenian
  'swe': 'swd.pdf', // Swedish

  // Asian Languages
  'hye': 'arm.pdf', // Armenian
  'kat': 'geo.pdf', // Georgian
  'kaz': 'kaz.pdf', // Kazakh
  'kir': 'kdo.pdf', // Kyrgyz
  'mon': 'khk.pdf', // Mongolian
  'tgk': 'pet.pdf', // Tajik
  'tuk': 'tck.pdf', // Turkmen
  'uzb': 'uzb.pdf', // Uzbek

  // African Languages
  'amh': 'amh.pdf', // Amharic
  'hau': 'hau.pdf', // Hausa
  'ibo': 'igr.pdf', // Igbo
  'yor': 'yor.pdf', // Yoruba
  'zul': 'zuu.pdf', // Zulu
  'swa': 'swa.pdf', // Swahili

  // Middle Eastern Languages
  'fas': 'prs.pdf', // Persian
  'heb': 'hbr.pdf', // Hebrew
  'kur': 'kdb1.pdf', // Kurdish
  'urd': 'urd.pdf', // Urdu

  // Southeast Asian Languages
  'khm': 'khm.pdf', // Khmer
  'lao': 'nol.pdf', // Lao
  'mya': 'bms.pdf', // Burmese
  'ind': 'inz.pdf', // Indonesian
  'msa': 'mli.pdf', // Malay
  'fil': 'tgl.pdf', // Filipino
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


export const getTranslationResponse = async (language: string) => {
  if (!LANGUAGE_URLS[language]) {
    throw new Error(`No URL found for ${language}`);
  }
  const uri = `https://www.ohchr.org/sites/default/files/UDHR/Documents/UDHR_Translations/` + LANGUAGE_URLS[language];
  const response = await sendRequestToProxy({
    externalUrl: uri,
    responseType: "arraybuffer",
    responseHeaders: {'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename=\"document.pdf\"'}
  }, {
    responseType: 'arraybuffer',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/pdf'
    }
  });
  const pdfDoc = await pdfjsLib.getDocument({ data: response }).promise;
  return decodeText(pdfDoc, language);
}


export {LANGUAGE_URLS, LANGUAGE_NAMES};