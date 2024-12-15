import * as React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import { vi } from 'vitest';
import QSearch, {QSearchProps} from '../components/QSearch';
import {MemoryRouter} from "react-router";

describe('QSearch Integration Tests', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });
    beforeEach(() => {
        // Setup mocks
        global.URL.createObjectURL = vi.fn(() => 'http://localhost:3000');

        global.Worker = vi.fn().mockImplementation(() => ({
            postMessage: vi.fn(),
            terminate: vi.fn(),
        }));

        vi.mock('three', () => ({
            ...vi.importActual('three'),
            WebGLRenderer: vi.fn().mockImplementation(() => ({
                render: vi.fn(),
                setSize: vi.fn(),
            })),
        }));
    });

    test('test fasta search terms', async () => {
        const element: React.ReactElement<QSearchProps> = React.createElement(QSearch, {
            openLogin: true,
            setOpenLogin: vitest.fn(),
            authenticated : false,
            setAuthenticated: vitest.fn(),
        });
        const routerElement = React.createElement(MemoryRouter, {}, element);
        render(routerElement);

        // select FASTA Search
        const fastaSearchButton = screen.getByText('FASTA Search');
        fireEvent.click(fastaSearchButton);

        const searchBar = screen.getByPlaceholderText('Search...');

        // Test multiple search terms
        const searchTerms = ['dog', 'cat', 'fish', 'elephant'];
        for (const term of searchTerms) {
            fireEvent.change(searchBar, { target: { value: term } });
            fireEvent.keyDown(searchBar, { key: 'Enter', code: 'Enter', charCode: 13 });
        }

        const result = screen.getByText('Enter Animal Name');
        expect(result).toBeInTheDocument();

        const calculateNCDButton = screen.getByText('Calculate');
        expect(calculateNCDButton).toBeInTheDocument();
    });

    test('test language', async () => {
        const element: React.ReactElement<QSearchProps> = React.createElement(QSearch, {
            openLogin: true,
            setOpenLogin: vitest.fn(),
            authenticated : false,
            setAuthenticated: vitest.fn(),
        });
        const routerElement = React.createElement(MemoryRouter, {}, element);
        render(routerElement);

        // select Language Analysis
        const languageButton = screen.getByText('Language Analysis');
        fireEvent.click(languageButton);

        // Test clicking on language options
        const languages = ['English', 'French', 'Russian', 'Spanish'];
        for (const lang of languages) {
            const langLabel = screen.getByText(lang);
            fireEvent.click(langLabel);
        }

        const calculateNCDButton = screen.getByText('Calculate');
        expect(calculateNCDButton).toBeInTheDocument();
    });
});