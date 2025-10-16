"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateContactUpdate = exports.validateContactInput = exports.validateClientListParams = exports.validateClientSearch = exports.validateClientStatus = exports.validateClientUpdate = exports.validateClientInput = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../config/logger");
const clientInputSchema = joi_1.default.object({
    company_name: joi_1.default.string().trim().min(2).max(255).required()
        .messages({
        'string.empty': 'Company name is required',
        'string.min': 'Company name must be at least 2 characters',
        'string.max': 'Company name cannot exceed 255 characters'
    }),
    address_line1: joi_1.default.string().trim().min(5).max(255).required()
        .messages({
        'string.empty': 'Address line 1 is required',
        'string.min': 'Address must be at least 5 characters',
        'string.max': 'Address line 1 cannot exceed 255 characters'
    }),
    address_line2: joi_1.default.string().trim().max(255).allow('', null).optional(),
    city: joi_1.default.string().trim().min(2).max(100).required()
        .messages({
        'string.empty': 'City is required',
        'string.min': 'City must be at least 2 characters',
        'string.max': 'City cannot exceed 100 characters'
    }),
    state: joi_1.default.string().trim().min(2).max(100).required()
        .messages({
        'string.empty': 'State/Province is required',
        'string.min': 'State must be at least 2 characters',
        'string.max': 'State cannot exceed 100 characters'
    }),
    postal_code: joi_1.default.string().trim().min(3).max(20).required()
        .messages({
        'string.empty': 'Postal code is required',
        'string.min': 'Postal code must be at least 3 characters',
        'string.max': 'Postal code cannot exceed 20 characters'
    }),
    contacts: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(100).required()
            .messages({
            'string.empty': 'Contact name is required',
            'string.min': 'Contact name must be at least 2 characters'
        }),
        role: joi_1.default.string().valid('primary', 'billing', 'site_manager', 'emergency', 'other').required()
            .messages({
            'any.only': 'Contact role must be one of: primary, billing, site_manager, emergency, other'
        }),
        phone: joi_1.default.string().trim().pattern(/^[\+]?[\s\-\(\)0-9]{10,20}$/).allow('', null).optional()
            .messages({
            'string.pattern.base': 'Contact phone number format is invalid'
        }),
        email: joi_1.default.string().trim().email().max(255).allow('', null).optional()
            .messages({
            'string.email': 'Contact email format is invalid'
        }),
        is_primary: joi_1.default.boolean().optional().default(false)
    })).optional().default([])
});
const clientUpdateSchema = joi_1.default.object({
    company_name: joi_1.default.string().trim().min(2).max(255).optional()
        .messages({
        'string.min': 'Company name must be at least 2 characters',
        'string.max': 'Company name cannot exceed 255 characters'
    }),
    address_line1: joi_1.default.string().trim().min(5).max(255).optional()
        .messages({
        'string.min': 'Address must be at least 5 characters',
        'string.max': 'Address line 1 cannot exceed 255 characters'
    }),
    address_line2: joi_1.default.string().trim().max(255).allow('', null).optional(),
    city: joi_1.default.string().trim().min(2).max(100).optional()
        .messages({
        'string.min': 'City must be at least 2 characters',
        'string.max': 'City cannot exceed 100 characters'
    }),
    state: joi_1.default.string().trim().min(2).max(100).optional()
        .messages({
        'string.min': 'State must be at least 2 characters',
        'string.max': 'State cannot exceed 100 characters'
    }),
    postal_code: joi_1.default.string().trim().min(3).max(20).optional()
        .messages({
        'string.min': 'Postal code must be at least 3 characters',
        'string.max': 'Postal code cannot exceed 20 characters'
    })
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
const clientStatusSchema = joi_1.default.object({
    status: joi_1.default.string().valid('active', 'inactive', 'suspended').required()
        .messages({
        'any.only': 'Status must be one of: active, inactive, suspended',
        'any.required': 'Status is required'
    })
});
const clientSearchSchema = joi_1.default.object({
    q: joi_1.default.string().trim().min(2).max(100).required()
        .messages({
        'string.empty': 'Search query is required',
        'string.min': 'Search query must be at least 2 characters',
        'string.max': 'Search query cannot exceed 100 characters'
    }),
    status: joi_1.default.string().valid('all', 'active', 'inactive', 'suspended').optional().default('all'),
    pco_id: joi_1.default.alternatives().try(joi_1.default.string().valid('all'), joi_1.default.number().integer().positive()).optional().default('all'),
    limit: joi_1.default.number().integer().min(1).max(50).optional().default(10)
        .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 50'
    })
});
const clientListParamsSchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).optional().default(1)
        .messages({
        'number.min': 'Page must be at least 1'
    }),
    limit: joi_1.default.number().integer().min(1).max(100).optional().default(25)
        .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    status: joi_1.default.string().valid('all', 'active', 'inactive', 'suspended').optional().default('all'),
    pco_id: joi_1.default.alternatives().try(joi_1.default.string().valid('all'), joi_1.default.number().integer().positive()).optional().default('all'),
    search: joi_1.default.string().trim().min(2).max(100).allow('').optional()
        .messages({
        'string.min': 'Search query must be at least 2 characters',
        'string.max': 'Search query cannot exceed 100 characters'
    })
});
const contactInputSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(2).max(100).required()
        .messages({
        'string.empty': 'Contact name is required',
        'string.min': 'Contact name must be at least 2 characters',
        'string.max': 'Contact name cannot exceed 100 characters'
    }),
    role: joi_1.default.string().valid('primary', 'billing', 'site_manager', 'emergency', 'other').required()
        .messages({
        'any.only': 'Contact role must be one of: primary, billing, site_manager, emergency, other',
        'any.required': 'Contact role is required'
    }),
    phone: joi_1.default.string().trim().pattern(/^[\+]?[\s\-\(\)0-9]{10,20}$/).allow('', null).optional()
        .messages({
        'string.pattern.base': 'Phone number format is invalid'
    }),
    email: joi_1.default.string().trim().email().max(255).allow('', null).optional()
        .messages({
        'string.email': 'Email format is invalid',
        'string.max': 'Email cannot exceed 255 characters'
    }),
    is_primary: joi_1.default.boolean().optional().default(false)
});
const contactUpdateSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(2).max(100).optional()
        .messages({
        'string.min': 'Contact name must be at least 2 characters',
        'string.max': 'Contact name cannot exceed 100 characters'
    }),
    role: joi_1.default.string().valid('primary', 'billing', 'site_manager', 'emergency', 'other').optional()
        .messages({
        'any.only': 'Contact role must be one of: primary, billing, site_manager, emergency, other'
    }),
    phone: joi_1.default.string().trim().pattern(/^[\+]?[\s\-\(\)0-9]{10,20}$/).allow('', null).optional()
        .messages({
        'string.pattern.base': 'Phone number format is invalid'
    }),
    email: joi_1.default.string().trim().email().max(255).allow('', null).optional()
        .messages({
        'string.email': 'Email format is invalid',
        'string.max': 'Email cannot exceed 255 characters'
    }),
    is_primary: joi_1.default.boolean().optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
const validateClientInput = (req, res, next) => {
    const { error, value } = clientInputSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Client input validation failed', {
            errors: errorMessages,
            user_id: req.user?.id
        });
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
exports.validateClientInput = validateClientInput;
const validateClientUpdate = (req, res, next) => {
    const { error, value } = clientUpdateSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Client update validation failed', {
            errors: errorMessages,
            user_id: req.user?.id
        });
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
exports.validateClientUpdate = validateClientUpdate;
const validateClientStatus = (req, res, next) => {
    const { error, value } = clientStatusSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Client status validation failed', {
            errors: errorMessages,
            user_id: req.user?.id
        });
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
exports.validateClientStatus = validateClientStatus;
const validateClientSearch = (req, res, next) => {
    const { error, value } = clientSearchSchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Client search validation failed', {
            errors: errorMessages,
            user_id: req.user?.id
        });
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
        return;
    }
    req.query = value;
    next();
};
exports.validateClientSearch = validateClientSearch;
const validateClientListParams = (req, res, next) => {
    const { error, value } = clientListParamsSchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Client list params validation failed', {
            errors: errorMessages,
            user_id: req.user?.id
        });
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
        return;
    }
    req.query = value;
    next();
};
exports.validateClientListParams = validateClientListParams;
const validateContactInput = (req, res, next) => {
    const { error, value } = contactInputSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Contact input validation failed', {
            errors: errorMessages,
            user_id: req.user?.id
        });
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
exports.validateContactInput = validateContactInput;
const validateContactUpdate = (req, res, next) => {
    const { error, value } = contactUpdateSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Contact update validation failed', {
            errors: errorMessages,
            user_id: req.user?.id
        });
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
exports.validateContactUpdate = validateContactUpdate;
//# sourceMappingURL=clientValidation.js.map