import { Request, Response } from 'express';
export declare class AuthController {
    static login(req: Request, res: Response): Promise<void>;
    static logout(req: Request, res: Response): Promise<void>;
    static getProfile(req: Request, res: Response): Promise<void>;
    static updateProfile(req: Request, res: Response): Promise<void>;
    static changePassword(req: Request, res: Response): Promise<void>;
    static forgotPassword(req: Request, res: Response): Promise<void>;
    static verifyResetToken(req: Request, res: Response): Promise<void>;
    static resetPassword(req: Request, res: Response): Promise<void>;
    static checkLockoutStatus(req: Request, res: Response): Promise<void>;
    static unlockAccount(req: Request, res: Response): Promise<void>;
    static validateToken(req: Request, res: Response): Promise<void>;
    static testEmail(req: Request, res: Response): Promise<void>;
    static tempResetAllPasswords: (req: Request, res: Response) => Promise<void>;
}
export default AuthController;
//# sourceMappingURL=authController.d.ts.map