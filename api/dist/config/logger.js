"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDatabase = exports.logAuth = exports.logRequest = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const env_1 = require("./env");
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, service, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level,
        message,
        service: service || env_1.config.server.name,
        ...meta
    });
}));
exports.logger = winston_1.default.createLogger({
    level: env_1.config.logging.level,
    format: logFormat,
    defaultMeta: {
        service: env_1.config.server.name,
        version: env_1.config.server.version
    },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} ${level}: ${message} ${metaStr}`;
            }))
        })
    ]
});
if (env_1.config.server.env === 'production') {
    exports.logger.add(new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error'
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: 'logs/combined.log'
    }));
}
const logRequest = (req, res, duration) => {
    exports.logger.info('HTTP Request', {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id
    });
};
exports.logRequest = logRequest;
const logAuth = (event, userId, details = {}) => {
    exports.logger.info('Authentication Event', {
        event,
        userId,
        ...details
    });
};
exports.logAuth = logAuth;
const logDatabase = (operation, table, duration, details = {}) => {
    exports.logger.debug('Database Operation', {
        operation,
        table,
        duration: duration ? `${duration}ms` : undefined,
        ...details
    });
};
exports.logDatabase = logDatabase;
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map