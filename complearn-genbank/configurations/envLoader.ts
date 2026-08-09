import 'dotenv/config'
import logger from "./logger";
import {config} from "dotenv";

const currentEnvironment = process.env.NODE_ENV;

const envFile = currentEnvironment ? `.env.${currentEnvironment}` : '.env';
config({path: `../${envFile}`});

logger.info(`Loaded environment: ${currentEnvironment}`);
logger.info(`Sample base url: ${process.env.BASE_URL}`);

const ENV_LOADER = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",

    // NCBI permits one API key per account. Keep a single configured key so
    // deployments do not imply that round-robin key rotation increases quota.
    GENBANK_API_KEY: process.env.GENBANK_API_KEY || process.env.GENBANK_API_KEY_1 || "",
    NCBI_EMAIL: process.env.NCBI_EMAIL || "",

    FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "",
    BASE_URL: process.env.BASE_URL || "",
    PORT: process.env.PORT || "3001",

    DB_HOST: process.env.DB_HOST || "",

    MYSQL_USER: process.env.MYSQL_USER || "",
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || "",
    MYSQL_DATABASE: process.env.MYSQL_DATABASE || "",

    NODE_ENV: process.env.NODE_ENV || ""
};

export default ENV_LOADER;
