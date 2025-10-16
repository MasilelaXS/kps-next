import { Request, Response } from 'express';
export declare const getFullSync: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const syncClients: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const syncChemicals: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const syncRecentReports: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const uploadReports: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const exportData: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=pcoSyncController.d.ts.map