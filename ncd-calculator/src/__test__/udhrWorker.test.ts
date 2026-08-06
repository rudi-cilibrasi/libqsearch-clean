import * as pdfjsLib from 'pdfjs-dist';
import {describe, expect, test} from 'vitest';

import {PDF_WORKER_URL} from '../functions/udhr';

describe('UDHR PDF worker', () => {
    test('uses the worker bundled with the installed pdfjs-dist package', () => {
        expect(PDF_WORKER_URL).not.toMatch(/^https?:\/\//);
        expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe(PDF_WORKER_URL);
    });
});
