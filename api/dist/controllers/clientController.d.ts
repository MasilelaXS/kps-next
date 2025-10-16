import { Request, Response } from 'express';
export declare class ClientController {
    static debugDatabase(req: Request, res: Response): Promise<void>;
    static getClientList(req: Request, res: Response): Promise<void>;
    static createClient(req: Request, res: Response): Promise<void>;
    static getClientById(req: Request, res: Response): Promise<void>;
    static updateClient(req: Request, res: Response): Promise<void>;
    static deleteClient(req: Request, res: Response): Promise<void>;
    static getClientContacts(req: Request, res: Response): Promise<void>;
    static addClientContact(req: Request, res: Response): Promise<void>;
    static updateClientContact(req: Request, res: Response): Promise<void>;
    static deleteClientContact(req: Request, res: Response): Promise<void>;
    static getClientReports(req: Request, res: Response): Promise<void>;
    static assignPcoToClient(req: Request, res: Response): Promise<void>;
    static unassignPcoFromClient(req: Request, res: Response): Promise<void>;
    static getClientPcoAssignments(req: Request, res: Response): Promise<void>;
    static searchClients(req: Request, res: Response): Promise<void>;
}
export default ClientController;
//# sourceMappingURL=clientController.d.ts.map