import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            validatedData?: any;
        }
    }
}
export interface AuthenticatedUser {
    id: number;
    login_id: string;
    role: 'admin' | 'pco' | 'both';
    first_name: string;
    last_name: string;
    email: string;
    session_id: string;
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (...roles: ("admin" | "pco")[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const requirePCO: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map