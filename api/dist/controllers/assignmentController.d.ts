import { Request, Response } from 'express';
export declare class AssignmentController {
    static getAssignmentList(req: Request, res: Response): Promise<void>;
    static getAssignmentStats(req: Request, res: Response): Promise<void>;
    static bulkAssignClients(req: Request, res: Response): Promise<void>;
    static bulkUnassignClients(req: Request, res: Response): Promise<void>;
    static getWorkloadBalance(req: Request, res: Response): Promise<void>;
}
export default AssignmentController;
//# sourceMappingURL=assignmentController.d.ts.map