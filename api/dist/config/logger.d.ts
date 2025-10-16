import winston from 'winston';
export declare const logger: winston.Logger;
export declare const logRequest: (req: any, res: any, duration: number) => void;
export declare const logAuth: (event: string, userId: number | string, details?: Record<string, any>) => void;
export declare const logDatabase: (operation: string, table: string, duration?: number, details?: Record<string, any>) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map