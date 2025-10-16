import mysql from 'mysql2/promise';
export declare const pool: mysql.Pool;
export declare const testConnection: () => Promise<void>;
export declare const executeQuery: <T = any>(query: string, params?: any[]) => Promise<T[]>;
export declare const executeQuerySingle: <T = any>(query: string, params?: any[]) => Promise<T | null>;
export declare const executeTransaction: (queries: Array<{
    query: string;
    params: any[];
}>) => Promise<any[]>;
export declare const closeConnection: () => Promise<void>;
//# sourceMappingURL=database.d.ts.map