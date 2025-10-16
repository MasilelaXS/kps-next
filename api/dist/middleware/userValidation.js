"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUserListParams = exports.validateUserSearch = exports.validatePasswordReset = exports.validateUserStatus = exports.validateUserUpdate = exports.validateUserInput = void 0;
const joi_1 = __importDefault(require("joi"));
const pcoNumberSchema = joi_1.default.string()
    .pattern(/^[a-zA-Z0-9]+$/)
    .min(3)
    .max(20)
    .optional()
    .messages({
    'string.pattern.base': 'PCO number can only contain letters and numbers',
    'string.min': 'PCO number must be at least 3 characters long',
    'string.max': 'PCO number cannot exceed 20 characters'
});
const nameSchema = joi_1.default.string()
    .min(2)
    .max(100)
    .required()
    .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required'
});
const emailSchema = joi_1.default.string()
    .email()
    .max(100)
    .required()
    .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email cannot exceed 100 characters',
    'any.required': 'Email is required'
});
const phoneSchema = joi_1.default.string()
    .pattern(/^[\+]?[1-9][\d\s\-\(\)]{7,15}$/)
    .optional()
    .allow(null, '')
    .messages({
    'string.pattern.base': 'Please provide a valid phone number'
});
const roleSchema = joi_1.default.string()
    .valid('admin', 'pco', 'both')
    .default('pco')
    .messages({
    'any.only': 'Role must be one of: admin, pco, both'
});
const statusSchema = joi_1.default.string()
    .valid('active', 'inactive')
    .required()
    .messages({
    'any.only': 'Status must be either active or inactive',
    'any.required': 'Status is required'
});
const passwordSchema = joi_1.default.string()
    .min(6)
    .max(100)
    .required()
    .messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password cannot exceed 100 characters',
    'any.required': 'Password is required'
});
const idSchema = joi_1.default.number()
    .integer()
    .positive()
    .required()
    .messages({
    'number.base': 'User ID must be a number',
    'number.integer': 'User ID must be an integer',
    'number.positive': 'User ID must be positive',
    'any.required': 'User ID is required'
});
const validateUserInput = (req, res, next) => {
    const schema = joi_1.default.object({
        pco_number: pcoNumberSchema,
        name: nameSchema,
        email: emailSchema,
        phone: phoneSchema,
        role: roleSchema,
        password: passwordSchema
    });
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
        return;
    }
    req.body = value;
    next();
};
exports.validateUserInput = validateUserInput;
const validateUserUpdate = (req, res, next) => {
    const idValidation = joi_1.default.object({ id: idSchema }).validate(req.params);
    if (idValidation.error) {
        res.status(400).json({
            success: false,
            message: 'Invalid user ID',
            errors: idValidation.error.details.map(detail => detail.message)
        });
        return;
    }
    const schema = joi_1.default.object({
        name: nameSchema.optional(),
        email: emailSchema.optional(),
        phone: phoneSchema,
        role: roleSchema.optional()
    });
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
        return;
    }
    if (Object.keys(value).length === 0) {
        res.status(400).json({
            success: false,
            message: 'At least one field must be provided for update'
        });
        return;
    }
    req.body = value;
    req.params = idValidation.value;
    next();
};
exports.validateUserUpdate = validateUserUpdate;
const validateUserStatus = (req, res, next) => {
    const idValidation = joi_1.default.object({ id: idSchema }).validate(req.params);
    if (idValidation.error) {
        res.status(400).json({
            success: false,
            message: 'Invalid user ID',
            errors: idValidation.error.details.map(detail => detail.message)
        });
        return;
    }
    const schema = joi_1.default.object({
        status: statusSchema
    });
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
        return;
    }
    req.body = value;
    req.params = idValidation.value;
    next();
};
exports.validateUserStatus = validateUserStatus;
const validatePasswordReset = (req, res, next) => {
    const idValidation = joi_1.default.object({ id: idSchema }).validate(req.params);
    if (idValidation.error) {
        res.status(400).json({
            success: false,
            message: 'Invalid user ID',
            errors: idValidation.error.details.map(detail => detail.message)
        });
        return;
    }
    const schema = joi_1.default.object({
        new_password: passwordSchema
    });
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
        return;
    }
    req.body = value;
    req.params = idValidation.value;
    next();
};
exports.validatePasswordReset = validatePasswordReset;
const validateUserSearch = (req, res, next) => {
    const schema = joi_1.default.object({
        q: joi_1.default.string().min(2).max(50).required().messages({
            'string.min': 'Search query must be at least 2 characters',
            'string.max': 'Search query cannot exceed 50 characters',
            'any.required': 'Search query (q) is required'
        }),
        role: joi_1.default.string().valid('admin', 'pco', 'both', 'all').optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'all').optional(),
        limit: joi_1.default.number().integer().min(1).max(50).optional().default(10).messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 50'
        })
    });
    const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Invalid search parameters',
            errors: errorMessages
        });
        return;
    }
    req.query = value;
    next();
};
exports.validateUserSearch = validateUserSearch;
const validateUserListParams = (req, res, next) => {
    const schema = joi_1.default.object({
        page: joi_1.default.number().integer().min(1).optional().default(1).messages({
            'number.min': 'Page must be at least 1'
        }),
        limit: joi_1.default.number().integer().min(1).max(100).optional().default(25).messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),
        role: joi_1.default.string().valid('admin', 'pco', 'both', 'all').optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'all').optional(),
        search: joi_1.default.string().min(2).max(50).optional().messages({
            'string.min': 'Search must be at least 2 characters',
            'string.max': 'Search cannot exceed 50 characters'
        })
    });
    const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Invalid parameters',
            errors: errorMessages
        });
        return;
    }
    req.query = value;
    next();
};
exports.validateUserListParams = validateUserListParams;
//# sourceMappingURL=userValidation.js.map