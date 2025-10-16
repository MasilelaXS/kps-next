"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnection = exports.executeTransaction = exports.executeQuerySingle = exports.executeQuery = exports.testConnection = exports.pool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("./env");
exports.pool = promise_1.default.createPool({
    host: env_1.config.database.host,
    port: env_1.config.database.port,
    user: env_1.config.database.user,
    password: env_1.config.database.password,
    database: env_1.config.database.name,
    connectionLimit: env_1.config.database.connectionLimit,
    multipleStatements: false,
    timezone: '+00:00',
    waitForConnections: true,
    queueLimit: 0
});
const testConnection = async () => {
    try {
        const connection = await exports.pool.getConnection();
        await connection.ping();
        const [rows] = await connection.execute('SELECT 1 as test');
        connection.release();
        console.log('✅ Database connection successful');
        console.log(`📊 Connected to ${env_1.config.database.name} at ${env_1.config.database.host}:${env_1.config.database.port}`);
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};
exports.testConnection = testConnection;
const executeQuery = async (query, params = []) => {
    const connection = await exports.pool.getConnection();
    try {
        const [rows] = await connection.execute(query, params);
        return rows;
    }
    finally {
        connection.release();
    }
};
exports.executeQuery = executeQuery;
const executeQuerySingle = async (query, params = []) => {
    const results = await (0, exports.executeQuery)(query, params);
    return results.length > 0 ? results[0] : null;
};
exports.executeQuerySingle = executeQuerySingle;
const executeTransaction = async (queries) => {
    const connection = await exports.pool.getConnection();
    try {
        await connection.beginTransaction();
        const results = [];
        for (const { query, params } of queries) {
            const [result] = await connection.execute(query, params);
            results.push(result);
        }
        await connection.commit();
        return results;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
};
exports.executeTransaction = executeTransaction;
const closeConnection = async () => {
    await exports.pool.end();
    console.log('📦 Database connection pool closed');
};
exports.closeConnection = closeConnection;
//# sourceMappingURL=database.js.map