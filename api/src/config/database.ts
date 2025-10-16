/**
 * KPS Pest Control Management System - Database Connection
 * 
 * MySQL database connection using connection pooling
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import mysql from 'mysql2/promise';
import { config } from './env';

// Create connection pool
export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  connectionLimit: config.database.connectionLimit,
  multipleStatements: false,
  timezone: '+00:00',
  waitForConnections: true,
  queueLimit: 0
});

/**
 * Test database connection
 */
export const testConnection = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    
    connection.release();
    
    console.log('✅ Database connection successful');
    console.log(`📊 Connected to ${config.database.name} at ${config.database.host}:${config.database.port}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

/**
 * Execute a query with parameters
 */
export const executeQuery = async <T = any>(
  query: string, 
  params: any[] = []
): Promise<T[]> => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, params);
    return rows as T[];
  } finally {
    connection.release();
  }
};

/**
 * Execute a query and return single result
 */
export const executeQuerySingle = async <T = any>(
  query: string,
  params: any[] = []
): Promise<T | null> => {
  const results = await executeQuery<T>(query, params);
  return results.length > 0 ? results[0] : null;
};

/**
 * Execute multiple queries in a transaction
 */
export const executeTransaction = async (
  queries: Array<{ query: string; params: any[] }>
): Promise<any[]> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Close database connection pool
 */
export const closeConnection = async (): Promise<void> => {
  await pool.end();
  console.log('📦 Database connection pool closed');
};