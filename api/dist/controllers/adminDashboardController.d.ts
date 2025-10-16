import { Request, Response } from 'express';
export declare const getMetrics: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getActivity: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getStats: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getPerformance: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const refreshCache: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=adminDashboardController.d.ts.map