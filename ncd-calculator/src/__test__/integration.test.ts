import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import QSearch from '../components/QSearch';

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useSearchParams: () => [new URLSearchParams(), vi.fn()],
        useLocation: () => ({ pathname: '/calculator', search: '', hash: '', state: null }),
        useNavigate: () => vi.fn()
    };
});

describe('QSearch Integration Tests', () => {
    // Mock props for QSearch
    const mockProps = {
        openLogin: false,
        setOpenLogin: vi.fn(),
        authenticated: false,
        setAuthenticated: vi.fn()
    };

    afterEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    beforeEach(() => {
        // Setup mocks
        global.URL.createObjectURL = vi.fn(() => 'http://localhost:3000');
        global.URL.revokeObjectURL = vi.fn();

        global.Worker = vi.fn().mockImplementation(() => ({
            postMessage: vi.fn(),
            terminate: vi.fn(),
            onmessage: vi.fn(),
            onerror: vi.fn()
        }));

        const mockGLContext = {
            getShaderPrecisionFormat: vi.fn(() => ({
                precision: 0,
                rangeMin: 0,
                rangeMax: 0,
            })),
            getExtension: vi.fn(),
            getParameter: vi.fn((param) => {
                if (param === 'VERSION') {
                    return 'WebGL 2.0 (OpenGL ES 3.0)';
                }
                return 'WebGL 1.0';
            }),
            createTexture: vi.fn(() => ({ texture: 'mockTexture' })),
            bindTexture: vi.fn(),
            createFramebuffer: vi.fn(() => ({})),
            createBuffer: vi.fn(() => ({})),
            activeTexture: vi.fn(),
            texParameteri: vi.fn(),
            texImage3D: vi.fn(),
            clearColor: vi.fn(),
            clearDepth: vi.fn(),
            clearStencil: vi.fn(),
            enable: vi.fn(),
            depthFunc: vi.fn(),
            frontFace: vi.fn(),
            cullFace: vi.fn(),
            viewport: vi.fn(),
            getContextAttributes: vi.fn(() => ({
                alpha: true,
                depth: true,
                stencil: false,
                antialias: true
            }))
        };

        global.HTMLCanvasElement.prototype.getContext = vi.fn(() => mockGLContext as unknown as CanvasRenderingContext2D);

        vi.mock('three', () => ({
            ...vi.importActual('three'),
            WebGLRenderer: vi.fn().mockImplementation(() => ({
                render: vi.fn(),
                setSize: vi.fn(),
                domElement: document.createElement('canvas'),
                dispose: vi.fn()
            })),
        }));

        // Mock LocalStorage
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn(),
            removeItem: vi.fn(),
            length: 0,
            key: vi.fn()
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    });

    test('test fasta search terms', async () => {
        const element = React.createElement(QSearch);
        render(element);

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
        const element = React.createElement(QSearch);
        render(element);

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