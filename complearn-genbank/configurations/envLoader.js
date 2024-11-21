require('dotenv').config(); // Load environment variables from .env

class EnvLoader {
    constructor(defaults = {}) {
        this.env = {...defaults};
        this.loadEnv();
    }

    loadEnv() {
        for (const key in this.env) {
            if (process.env[key] !== undefined) {
                this.env[key] = process.env[key];
            }
        }
    }

    get(key) {
        return this.env[key];
    }
}

// default values
const envLoader = new EnvLoader({
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GITHUB_CLIENT_ID: '',
    GITHUB_CLIENT_SECRET: '',

    GENBANK_API_KEY_1: '',
    GENBANK_API_KEY_2: '',
    GENBANK_API_KEY_3: '',

    FRONTEND_BASE_URL: 'http://localhost:3000',
    BASE_URL: 'http://localhost:3001/api',
    PORT: '3001',
});

module.exports = envLoader;
