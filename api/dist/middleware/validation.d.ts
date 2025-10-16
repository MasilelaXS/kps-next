import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validateVersionInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateVersionQuery: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateVersionStatusUpdate: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateVersionId: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateRequest: (schema: Joi.Schema, source?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map