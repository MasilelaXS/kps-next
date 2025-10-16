import { Request, Response } from 'express';
export declare class VersionController {
    static getCurrentVersion(req: Request, res: Response): Promise<void>;
    static releaseVersion(req: Request, res: Response): Promise<void>;
    static getVersionHistory(req: Request, res: Response): Promise<void>;
    static updateVersionStatus(req: Request, res: Response): Promise<void>;
}
export default VersionController;
//# sourceMappingURL=versionController.d.ts.map