export declare const config: {
    server: {
        env: string;
        port: number;
        host: string;
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
        sessionSecret: string;
        sessionTimeout: string;
        corsOrigin: string;
        corsCredentials: boolean;
        rateLimitWindowMs: number;
        rateLimitMaxRequests: number;
        maxLoginAttempts: number;
        accountLockoutDuration: number;
    };
    logging: {
        level: string;
        format: string;
        file: string;
    };
    upload: {
        maxSize: number;
        uploadDir: string;
        allowedTypes: string[];
    };
    email: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        password: string;
        from: string;
        replyTo: string;
    };
    frontend: {
        url: string;
    };
    timezone: string;
};
export declare const isDevelopment: () => boolean;
export declare const isProduction: () => boolean;
export declare const isTest: () => boolean;
//# sourceMappingURL=env.d.ts.map