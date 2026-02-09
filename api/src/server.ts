/**
 * KPS Pest Control Management System - Server Entry Point
 * 
 * Application startup and graceful shutdown handling
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import app from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { testConnection, closeConnection } from './config/database';
import { initializeCronJobs } from './config/cron';
import VersionController from './controllers/versionController';

/**
 * Start the server with proper error handling
 */
const startServer = async (): Promise<void> => {
  try {
    // Test database connection first
    logger.info('🔄 Testing database connection...');
    await testConnection();
    
    // Sync version from package.json to database
    logger.info('🔄 Syncing version to database...');
    await VersionController.syncVersionToDatabase();
    
    // Initialize cron jobs for automated tasks
    logger.info('⏰ Initializing scheduled tasks...');
    initializeCronJobs();
    
    // Start HTTP server - listen on 0.0.0.0 to accept connections from all network interfaces
    const server = app.listen(config.server.port, '0.0.0.0', () => {
      logger.info('🚀 Server started successfully', {
        name: config.server.name,
        version: config.server.version,
        port: config.server.port,
        environment: config.server.env,
        url: `http://localhost:${config.server.port}`,
        healthCheck: `http://localhost:${config.server.port}/health`,
        apiStatus: `http://localhost:${config.server.port}/api/status`,
        apiDocs: `http://localhost:${config.server.port}/api-docs`
      });
      
      console.log(`\n🎉 KPS API Server is running!`);
      console.log(`🔗 Local: http://localhost:${config.server.port}`);
      console.log(`🌐 Network: http://0.0.0.0:${config.server.port}`);
      console.log(`🩺 Health: http://localhost:${config.server.port}/health`);
      console.log(`📊 Status: http://localhost:${config.server.port}/api/status`);
      console.log(`📚 API Docs: http://localhost:${config.server.port}/api-docs`);
      console.log(`\n🛑 Press Ctrl+C to stop the server\n`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${config.server.port} is already in use`);
        console.error(`❌ Port ${config.server.port} is already in use`);
      } else {
        logger.error('❌ Server error', { error: error.message });
        console.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`🛑 Received ${signal}, shutting down gracefully`);
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('🔒 HTTP server closed');
        
        // Close database connections
        try {
          await closeConnection();
        } catch (error) {
          logger.error('❌ Error closing database connections', { error });
        }
        
        logger.info('✅ Graceful shutdown complete');
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Could not close connections in time, forcefully shutting down');
        console.error('⚠️  Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle process termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown startup error';
    logger.error('❌ Failed to start server', { error: errorMessage });
    console.error('❌ Failed to start server:', errorMessage);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : reason,
    promise 
  });
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Start the server
startServer();