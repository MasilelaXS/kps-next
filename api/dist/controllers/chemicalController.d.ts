import { Request, Response } from 'express';
export declare class ChemicalController {
    static getChemicalList(req: Request, res: Response): Promise<void>;
    static createChemical(req: Request, res: Response): Promise<void>;
    static getChemicalById(req: Request, res: Response): Promise<void>;
    static updateChemical(req: Request, res: Response): Promise<void>;
    static updateChemicalStatus(req: Request, res: Response): Promise<void>;
    static getChemicalsByType(req: Request, res: Response): Promise<void>;
    static getChemicalsForPco(req: Request, res: Response): Promise<void>;
    static searchChemicals(req: Request, res: Response): Promise<void>;
    static deleteChemical(req: Request, res: Response): Promise<void>;
}
export default ChemicalController;
//# sourceMappingURL=chemicalController.d.ts.map