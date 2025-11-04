#!/usr/bin/env node

/**
 * KPS Pest Control API - Standalone Server
 * Runs directly on a port (not using Passenger)
 */

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';
const PORT = process.env.PORT || 3001;

console.log('🔄 Starting KPS API...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);

try {
  // Import the Express app
  const app = require('./dist/app').default;
  console.log('✅ Express app loaded');

  // Initialize database connection
  const { testConnection } = require('./dist/config/database');
  const { logger } = require('./dist/config/logger');

  // Start server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KPS API Server running on port ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    
    // Test database connection after server starts
    testConnection()
      .then(() => {
        logger.info('✅ Database connection established');
        console.log('✅ Database connected');
      })
      .catch((error) => {
        logger.error('❌ Database connection failed:', error);
        console.error('❌ Database Error:', error.message);
      });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('⚠️  SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
} catch (error) {
  console.error('💥 Fatal error loading app:', error);
  process.exit(1);
}
