import app from "../app.js";
import http from "http";
import logger from "../configurations/logger.js";
import { syncSequelize } from "../configurations/databaseConnection.js";

const port = normalizePort(process.env.PORT || '3001');
app.set('port', port);

const server = http.createServer(app);

// Sync database schema before the app start
syncSequelize();

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
        throw error;
    }

    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            logger.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + (addr ? addr.port : '');
    logger.info('Listening on ' + bind);
}

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
