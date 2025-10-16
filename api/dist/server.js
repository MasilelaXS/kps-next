"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const database_1 = require("./config/database");
const startServer = async () => {
    try {
        logger_1.logger.info('🔄 Testing database connection...');
        await (0, database_1.testConnection)();
        const server = app_1.default.listen(env_1.config.server.port, () => {
            logger_1.logger.info('🚀 Server started successfully', {
                name: env_1.config.server.name,
                version: env_1.config.server.version,
                port: env_1.config.server.port,
                environment: env_1.config.server.env,
                url: `http://localhost:${env_1.config.server.port}`,
                healthCheck: `http://localhost:${env_1.config.server.port}/health`,
                apiStatus: `http://localhost:${env_1.config.server.port}/api/status`,
                apiDocs: `http://localhost:${env_1.config.server.port}/api-docs`
            });
            console.log(`\n🎉 KPS API Server is running!`);
            console.log(`🔗 URL: http://localhost:${env_1.config.server.port}`);
            console.log(`🩺 Health: http://localhost:${env_1.config.server.port}/health`);
            console.log(`📊 Status: http://localhost:${env_1.config.server.port}/api/status`);
            console.log(`📚 API Docs: http://localhost:${env_1.config.server.port}/api-docs`);
            console.log(`\n🛑 Press Ctrl+C to stop the server\n`);
        });
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger_1.logger.error(`❌ Port ${env_1.config.server.port} is already in use`);
                console.error(`❌ Port ${env_1.config.server.port} is already in use`);
            }
            else {
                logger_1.logger.error('❌ Server error', { error: error.message });
                console.error('❌ Server error:', error.message);
            }
            process.exit(1);
        });
        const gracefulShutdown = async (signal) => {
            logger_1.logger.info(`🛑 Received ${signal}, shutting down gracefully`);
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            server.close(async () => {
                logger_1.logger.info('🔒 HTTP server closed');
                try {
                    await (0, database_1.closeConnection)();
                }
                catch (error) {
                    logger_1.logger.error('❌ Error closing database connections', { error });
                }
                logger_1.logger.info('✅ Graceful shutdown complete');
                console.log('✅ Graceful shutdown complete');
                process.exit(0);
            });
            setTimeout(() => {
                logger_1.logger.error('⚠️  Could not close connections in time, forcefully shutting down');
                console.error('⚠️  Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown startup error';
        logger_1.logger.error('❌ Failed to start server', { error: errorMessage });
        console.error('❌ Failed to start server:', errorMessage);
        process.exit(1);
    }
};
process.on('uncaughtException', (error) => {
    logger_1.logger.error('💥 Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('💥 Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        promise
    });
    console.error('💥 Unhandled Rejection:', reason);
    process.exit(1);
});
startServer();
//# sourceMappingURL=server.js.map