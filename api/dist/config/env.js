"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isProduction = exports.isDevelopment = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'JWT_SECRET'
];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}
exports.config = {
    server: {
        env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3001', 10),
        name: 'KPS Pest Control API',
        version: process.env.API_VERSION || 'v1'
    },
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '3306', 10),
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
        sessionTimeout: process.env.SESSION_TIMEOUT || '24h',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined'
    },
    upload: {
        maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10),
        allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,application/pdf').split(',')
    }
};
const isDevelopment = () => exports.config.server.env === 'development';
exports.isDevelopment = isDevelopment;
const isProduction = () => exports.config.server.env === 'production';
exports.isProduction = isProduction;
const isTest = () => exports.config.server.env === 'test';
exports.isTest = isTest;
if ((0, exports.isDevelopment)()) {
    console.log('🔧 Environment Configuration:');
    console.log(`   Environment: ${exports.config.server.env}`);
    console.log(`   Port: ${exports.config.server.port}`);
    console.log(`   Database: ${exports.config.database.host}:${exports.config.database.port}/${exports.config.database.name}`);
    console.log(`   CORS Origin: ${exports.config.security.corsOrigin}`);
}
//# sourceMappingURL=env.js.map