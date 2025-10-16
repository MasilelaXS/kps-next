import Joi from 'joi';
export declare const loginSchema: Joi.ObjectSchema<any>;
export declare const changePasswordSchema: Joi.ObjectSchema<any>;
export declare const forgotPasswordSchema: Joi.ObjectSchema<any>;
export declare const resetPasswordSchema: Joi.ObjectSchema<any>;
export declare const profileUpdateSchema: Joi.ObjectSchema<any>;
export declare const validateLoginInput: (data: any) => Joi.ValidationResult<any>;
export declare const validateChangePasswordInput: (data: any) => Joi.ValidationResult<any>;
export declare const validateForgotPasswordInput: (data: any) => Joi.ValidationResult<any>;
export declare const validateResetPasswordInput: (data: any) => Joi.ValidationResult<any>;
export declare const validateProfileUpdateInput: (data: any) => Joi.ValidationResult<any>;
export declare const formatValidationErrors: (error: Joi.ValidationError) => {
    field: string;
    message: string;
    value: any;
}[];
export declare const validateRequest: (schema: Joi.ObjectSchema) => (req: any, res: any, next: any) => any;
//# sourceMappingURL=validation.d.ts.map