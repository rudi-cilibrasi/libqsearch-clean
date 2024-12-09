/**
 * Module dependencies.
 */
import app from "../app";
import debug from "debug";
import http from "http";
import logger from "../configurations/logger";
import { syncSequelize } from "../configurations/databaseConnection";
import ENV_LOADER from "../configurations/envLoader";
import {AddressInfo} from "net";

const debugServer = debug('myapp:server'); // For debugging

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(ENV_LOADER.PORT || '3001');
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

// Sync database schema before the app start
syncSequelize();

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError); // Handle errors
server.on('listening', onListening); // Handle successful server start

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val: string) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        return val;
    }

    if (port >= 0) {
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: NodeJS.ErrnoException) {
    // Check if the error is related to the 'listen' syscall
    if (error.syscall !== 'listen') {
        throw error; // Rethrow if not a listen error
    }

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    // Handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            logger.error(`${bind} requires elevated privileges`); // Log the error
            process.exit(1); // Exit the process with error code 1
            break;
        case 'EADDRINUSE':
            logger.error(`${bind} is already in use`); // Log the error
            process.exit(1); // Exit the process with error code 1
            break;
        default:
            logger.error(`Unexpected error: ${error.message}`); // Log any other errors
            throw error; // Rethrow the error for further handling
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
    const addr: AddressInfo | string | null = server.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + (addr ? addr.port : port);
    debugServer('Listening on ' + bind);
    logger.info(`Server is running at http://localhost:${port}`);
}
