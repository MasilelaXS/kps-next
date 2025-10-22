import { Request, Response } from 'express';
export declare const createNotification: (userId: number, type: "assignment" | "report_declined" | "report_submitted" | "system_update", title: string, message: string) => Promise<number | null>;
export declare const getNotifications: (req: Request, res: Response) => Promise<void>;
export declare const markAsRead: (req: Request, res: Response) => Promise<void>;
export declare const sendNotification: (req: Request, res: Response) => Promise<void>;
export declare const markAllAsRead: (req: Request, res: Response) => Promise<void>;
export declare const deleteNotification: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=notificationController.d.ts.map