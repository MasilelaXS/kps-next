export declare const config: {
    server: {
        env: string;
        port: number;
        name: string;
        version: string;
    };
    database: {
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
        connectionLimit: number;
        acquireTimeout: number;
        timeout: number;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    security: {
        bcryptRounds: number;
        sessionTimeout: string;
        corsOrigin: string;
        rateLimitWindowMs: number;
        rateLimitMaxRequests: number;
    };
    logging: {
        level: string;
        format: string;
    };
    upload: {
        maxSize: number;
        allowedTypes: string[];
    };
};
export declare const isDevelopment: () => boolean;
export declare const isProduction: () => boolean;
export declare const isTest: () => boolean;
//# sourceMappingURL=env.d.ts.map