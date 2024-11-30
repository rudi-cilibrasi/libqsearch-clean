const dotenv = require('dotenv');
const path = require('path');
const logger = require('./logger');

currentEnvironment = process.env.NODE_ENV;

const envFile = currentEnvironment ? `.env.${currentEnvironment}` : '.env';

dotenv.config({path: path.resolve(__dirname, "..", envFile)});

logger.info(`Loaded environment: ${currentEnvironment}`);
logger.info(`Sample base url: ${process.env.BASE_URL}`);

const ENV_LOADER = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",

    GENBANK_API_KEY_1: process.env.GENBANK_API_KEY_1 || "",
    GENBANK_API_KEY_2: process.env.GENBANK_API_KEY_2 || "",
    GENBANK_API_KEY_3: process.env.GENBANK_API_KEY_3 || "",

    FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "",
    BASE_URL: process.env.BASE_URL || "",
    PORT: process.env.PORT || "",

    DB_HOST: process.env.DB_HOST || "",

    MYSQL_USER: process.env.MYSQL_USER || "",
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || "",
    MYSQL_DATABASE: process.env.MYSQL_DATABASE || "",
};

module.exports = ENV_LOADER;
