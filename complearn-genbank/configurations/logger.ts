import winston, {Logger} from 'winston';
const { createLogger, format, transports } = winston;

const logger: Logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.printf(({ timestamp, level, message, requestId, transaction }) => {
            const baseLine = `${timestamp} [${level.toUpperCase()}] [${requestId}] ${message}`;
            if (transaction) {
                const prettyJson = JSON.stringify(transaction, null, 2);
                return `${baseLine}\n${prettyJson}`;
            }

            return baseLine;
        })
    ),
    transports: [
        new transports.Console(),
        new transports.File({
            filename: '/var/log/complearn_api',
            maxsize: 50 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});

export default logger;