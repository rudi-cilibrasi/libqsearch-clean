const winston = require('winston');
const { createLogger, format, transports } = winston;

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }), // Include stack trace for error objects
        format.printf(({ timestamp, level, message, stack }) =>
            stack
                ? `${timestamp} [${level.toUpperCase()}]: ${message}\nStack Trace:\n${stack}`
                : `${timestamp} [${level.toUpperCase()}]: ${message}`
        )
    ),
    transports: [
        new transports.Console(),
        new transports.File({
            filename: '/var/log/complearn_api', // Rotated files are application.log.1, application.log.2, ...
            maxsize: 50 * 1024 * 1024,       // 50 MB
            maxFiles: 5,                     // Keep 5 rotated files, older will be removed
        }),
    ],
});

module.exports = logger;