"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = exports.formatValidationErrors = exports.validateProfileUpdateInput = exports.validateResetPasswordInput = exports.validateForgotPasswordInput = exports.validateChangePasswordInput = exports.validateLoginInput = exports.profileUpdateSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.changePasswordSchema = exports.loginSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.loginSchema = joi_1.default.object({
    login_id: joi_1.default.string()
        .required()
        .pattern(/^(admin|pco)\d+$/)
        .messages({
        'any.required': 'Login ID is required',
        'string.empty': 'Login ID is required',
        'string.pattern.base': 'Login ID must be in format admin[number] or pco[number] (e.g., admin12345 or pco67890)'
    }),
    password: joi_1.default.string()
        .required()
        .min(1)
        .messages({
        'any.required': 'Password is required',
        'string.empty': 'Password is required',
        'string.min': 'Password is required'
    })
});
exports.changePasswordSchema = joi_1.default.object({
    current_password: joi_1.default.string()
        .required()
        .messages({
        'any.required': 'Current password is required',
        'string.empty': 'Current password is required'
    }),
    new_password: joi_1.default.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .messages({
        'any.required': 'New password is required',
        'string.empty': 'New password is required',
        'string.min': 'New password must be at least 8 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    })
});
exports.forgotPasswordSchema = joi_1.default.object({
    login_id: joi_1.default.string()
        .required()
        .pattern(/^(admin|pco)\d+$/)
        .messages({
        'any.required': 'Login ID is required',
        'string.empty': 'Login ID is required',
        'string.pattern.base': 'Login ID must be in format admin[number] or pco[number]'
    })
});
exports.resetPasswordSchema = joi_1.default.object({
    token: joi_1.default.string()
        .required()
        .uuid()
        .messages({
        'any.required': 'Reset token is required',
        'string.empty': 'Reset token is required',
        'string.guid': 'Invalid reset token format'
    }),
    new_password: joi_1.default.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .messages({
        'any.required': 'New password is required',
        'string.empty': 'New password is required',
        'string.min': 'New password must be at least 8 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    })
});
exports.profileUpdateSchema = joi_1.default.object({
    name: joi_1.default.string()
        .optional()
        .min(2)
        .max(100)
        .pattern(/^[a-zA-Z\s'-]+$/)
        .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 100 characters',
        'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes'
    }),
    email: joi_1.default.string()
        .optional()
        .email()
        .max(100)
        .messages({
        'string.email': 'Please enter a valid email address',
        'string.max': 'Email cannot exceed 100 characters'
    }),
    phone: joi_1.default.string()
        .optional()
        .allow('')
        .pattern(/^[\+]?[\d\s\-\(\)]+$/)
        .min(10)
        .max(20)
        .messages({
        'string.pattern.base': 'Please enter a valid phone number',
        'string.min': 'Phone number must be at least 10 characters long',
        'string.max': 'Phone number cannot exceed 20 characters'
    })
});
const validateLoginInput = (data) => {
    return exports.loginSchema.validate(data, { abortEarly: false });
};
exports.validateLoginInput = validateLoginInput;
const validateChangePasswordInput = (data) => {
    return exports.changePasswordSchema.validate(data, { abortEarly: false });
};
exports.validateChangePasswordInput = validateChangePasswordInput;
const validateForgotPasswordInput = (data) => {
    return exports.forgotPasswordSchema.validate(data, { abortEarly: false });
};
exports.validateForgotPasswordInput = validateForgotPasswordInput;
const validateResetPasswordInput = (data) => {
    return exports.resetPasswordSchema.validate(data, { abortEarly: false });
};
exports.validateResetPasswordInput = validateResetPasswordInput;
const validateProfileUpdateInput = (data) => {
    return exports.profileUpdateSchema.validate(data, { abortEarly: false });
};
exports.validateProfileUpdateInput = validateProfileUpdateInput;
const formatValidationErrors = (error) => {
    return error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
    }));
};
exports.formatValidationErrors = formatValidationErrors;
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: (0, exports.formatValidationErrors)(error)
            });
        }
        req.validatedData = value;
        next();
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validation.js.map