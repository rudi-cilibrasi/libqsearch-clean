import QSearch from '../components/QSearch.jsx';
import {fireEvent, render, screen} from '@testing-library/react';

test('test fasta search terms', async () => {
    global.URL.createObjectURL = vi.fn(() => 'http://localhost:3000');

    global.Worker = vi.fn().mockImplementation(() => ({
        postMessage: vi.fn(),
        terminate: vi.fn(),
    }));

    global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        getShaderPrecisionFormat: vi.fn(() => ({
            precision: 0, // Mock return values based on your needs
            rangeMin: 0,
            rangeMax: 0,
        })),
        getExtension: vi.fn(),
        getParameter: vi.fn((param) => {
            if (param === 'VERSION') {
                return 'WebGL 2.0 (OpenGL ES 3.0)'; // Mock WebGL version string
            }
            return 'WebGL 1.0';
        }),
        createTexture: vi.fn(() => {
            // Return a mock texture object
            return { texture: 'mockTexture' };
        }),
        // Mock WebGL methods used in Three.js rendering
        bindTexture: vi.fn(() => {}), // Mock bindTexture
        // Other WebGL methods might be used, mock them similarly
        createFramebuffer: vi.fn(() => ({})),
        createBuffer: vi.fn(() => ({})),
        activeTexture: vi.fn(() => {}),
        texParameteri: vi.fn(() => {}),
        texImage3D: vi.fn(() => {}),
        clearColor: vi.fn(() => {}),
        clearDepth: vi.fn(() => {}),
        clearStencil: vi.fn(() => {}),
        enable: vi.fn(() => {}),
        depthFunc: vi.fn(() => {}),
        frontFace: vi.fn(() => {}),
        cullFace: vi.fn(() => {}),
        viewport: vi.fn(() => {}),
        getContextAttributes:vi.fn(() => ({ alpha: true, depth: true, stencil: false, antialias: true }))
    }));

    vi.mock('three', () => ({
        ...vi.importActual('three'),
        WebGLRenderer: vi.fn().mockImplementation(() => ({
            render: vi.fn(),
            setSize: vi.fn(),
        })),
    }));

    render(<QSearch />);

    // select FASTA Search
    const fastaSearchButton = screen.getByText('FASTA Search');
    fireEvent.click(fastaSearchButton);

    const searchBar = screen.getByPlaceholderText('Search...');

    fireEvent.change(searchBar, { target: { value: 'dog' } });
    fireEvent.keyDown(searchBar, { key: 'Enter', code: 'Enter', charCode: 13 });

    fireEvent.change(searchBar, { target: { value: 'cat' } });
    fireEvent.keyDown(searchBar, { key: 'Enter', code: 'Enter', charCode: 13 });

    fireEvent.change(searchBar, { target: { value: 'fish' } });
    fireEvent.keyDown(searchBar, { key: 'Enter', code: 'Enter', charCode: 13 });

    fireEvent.change(searchBar, { target: { value: 'elephant' } });
    fireEvent.keyDown(searchBar, { key: 'Enter', code: 'Enter', charCode: 13 });

    screen.debug(undefined, Infinity);
    const result = screen.getByText('Enter Animal Name');
    expect(result).toBeInTheDocument();

    const calculateNCDButton = screen.getByText('Calculate NCD Matrix');
    // fireEvent.click(calculateNCDButton);
    //
    // const matrixTable = await screen.findByText("Computing result...");
    // screen.debug(matrixTable, Infinity);
}, 10000000);

test('test language', async () => {
    global.URL.createObjectURL = vi.fn(() => 'http://localhost:3000');

    global.Worker = vi.fn().mockImplementation(() => ({
        postMessage: vi.fn(),
        terminate: vi.fn(),
    }));

    global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        getShaderPrecisionFormat: vi.fn(() => ({
            precision: 0, // Mock return values based on your needs
            rangeMin: 0,
            rangeMax: 0,
        })),
        getExtension: vi.fn(),
        getParameter: vi.fn((param) => {
            if (param === 'VERSION') {
                return 'WebGL 2.0 (OpenGL ES 3.0)'; // Mock WebGL version string
            }
            return 'WebGL 1.0';
        }),
        createTexture: vi.fn(() => {
            // Return a mock texture object
            return { texture: 'mockTexture' };
        }),
        // Mock WebGL methods used in Three.js rendering
        bindTexture: vi.fn(() => {}), // Mock bindTexture
        // Other WebGL methods might be used, mock them similarly
        createFramebuffer: vi.fn(() => ({})),
        createBuffer: vi.fn(() => ({})),
        activeTexture: vi.fn(() => {}),
        texParameteri: vi.fn(() => {}),
        texImage3D: vi.fn(() => {}),
        clearColor: vi.fn(() => {}),
        clearDepth: vi.fn(() => {}),
        clearStencil: vi.fn(() => {}),
        enable: vi.fn(() => {}),
        depthFunc: vi.fn(() => {}),
        frontFace: vi.fn(() => {}),
        cullFace: vi.fn(() => {}),
        viewport: vi.fn(() => {}),
        getContextAttributes:vi.fn(() => ({ alpha: true, depth: true, stencil: false, antialias: true }))
    }));

    vi.mock('three', () => ({
        ...vi.importActual('three'),
        WebGLRenderer: vi.fn().mockImplementation(() => ({
            render: vi.fn(),
            setSize: vi.fn(),
        })),
    }));

    render(<QSearch />);

    // select FASTA Search
    const fastaSearchButton = screen.getByText('Language Analysis');
    fireEvent.click(fastaSearchButton);

    const englishLabel = screen.getByText('English');
    const frenchLabel = screen.getByText('French');
    const russianLabel = screen.getByText('Russian');
    const spanishLabel = screen.getByText('Spanish');

    // Simulate clicking on each label
    fireEvent.click(englishLabel);
    fireEvent.click(frenchLabel);
    fireEvent.click(russianLabel);
    fireEvent.click(spanishLabel);

    const calculateNCDButton = screen.getByText('Calculate NCD Matrix');
    //fireEvent.click(calculateNCDButton);
}, 10000000);
