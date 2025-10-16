import { Request, Response } from 'express';
export declare class UserController {
    static getUserList(req: Request, res: Response): Promise<void>;
    static createUser(req: Request, res: Response): Promise<void>;
    static getUserById(req: Request, res: Response): Promise<void>;
    static updateUser(req: Request, res: Response): Promise<void>;
    static deleteUser(req: Request, res: Response): Promise<void>;
    static updateUserStatus(req: Request, res: Response): Promise<void>;
    static resetUserPassword(req: Request, res: Response): Promise<void>;
    static getUserAssignments(req: Request, res: Response): Promise<void>;
    static unassignAllClients(req: Request, res: Response): Promise<void>;
    static searchUsers(req: Request, res: Response): Promise<void>;
}
export default UserController;
//# sourceMappingURL=userController.d.ts.map