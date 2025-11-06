"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateChemicalSearch = exports.validateChemicalListParams = exports.validateChemicalStatus = exports.validateChemicalUpdate = exports.validateChemicalInput = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../config/logger");
const USAGE_TYPES = ['bait_inspection', 'fumigation', 'multi_purpose'];
const STATUSES = ['active', 'inactive'];
const validateChemicalInput = (req, res, next) => {
    const schema = joi_1.default.object({
        name: joi_1.default.string()
            .trim()
            .min(2)
            .max(200)
            .required()
            .messages({
            'string.empty': 'Chemical name is required',
            'string.min': 'Chemical name must be at least 2 characters',
            'string.max': 'Chemical name cannot exceed 200 characters',
            'any.required': 'Chemical name is required'
        }),
        active_ingredients: joi_1.default.string()
            .trim()
            .min(2)
            .allow(null, '')
            .optional()
            .messages({
            'string.min': 'Active ingredients must be at least 2 characters if provided'
        }),
        quantity_unit: joi_1.default.string()
            .trim()
            .min(1)
            .max(20)
            .required()
            .messages({
            'string.empty': 'Quantity unit is required',
            'string.min': 'Quantity unit must be at least 1 character',
            'string.max': 'Quantity unit cannot exceed 20 characters',
            'any.required': 'Quantity unit is required'
        }),
        l_number: joi_1.default.string()
            .trim()
            .min(1)
            .max(50)
            .required()
            .messages({
            'string.empty': 'L-Number is required (used as identifier)',
            'string.min': 'L-Number must be at least 1 character',
            'string.max': 'L-Number cannot exceed 50 characters',
            'any.required': 'L-Number is required (used as identifier)'
        }),
        batch_number: joi_1.default.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .messages({
            'string.empty': 'Batch number is required (used as identifier)',
            'string.min': 'Batch number must be at least 1 character',
            'string.max': 'Batch number cannot exceed 100 characters',
            'any.required': 'Batch number is required (used as identifier)'
        }),
        usage_type: joi_1.default.string()
            .valid(...USAGE_TYPES)
            .required()
            .messages({
            'any.only': 'Usage type must be one of: bait_inspection, fumigation, or multi_purpose',
            'any.required': 'Usage type is required'
        }),
        safety_information: joi_1.default.string()
            .trim()
            .allow(null, '')
            .optional()
            .messages({
            'string.empty': 'Safety information cannot be empty if provided'
        })
    });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Chemical validation failed', {
            errors,
            user_id: req.user?.id
        });
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
        return;
    }
    req.body = value;
    next();
};
exports.validateChemicalInput = validateChemicalInput;
const validateChemicalUpdate = (req, res, next) => {
    const schema = joi_1.default.object({
        name: joi_1.default.string()
            .trim()
            .min(2)
            .max(200)
            .optional()
            .messages({
            'string.empty': 'Chemical name cannot be empty',
            'string.min': 'Chemical name must be at least 2 characters',
            'string.max': 'Chemical name cannot exceed 200 characters'
        }),
        active_ingredients: joi_1.default.string()
            .trim()
            .min(2)
            .allow(null, '')
            .optional()
            .messages({
            'string.min': 'Active ingredients must be at least 2 characters if provided'
        }),
        quantity_unit: joi_1.default.string()
            .trim()
            .min(1)
            .max(20)
            .optional()
            .messages({
            'string.empty': 'Quantity unit cannot be empty',
            'string.min': 'Quantity unit must be at least 1 character',
            'string.max': 'Quantity unit cannot exceed 20 characters'
        }),
        l_number: joi_1.default.string()
            .trim()
            .min(1)
            .max(50)
            .optional()
            .messages({
            'string.empty': 'L-Number cannot be empty (used as identifier)',
            'string.min': 'L-Number must be at least 1 character',
            'string.max': 'L-Number cannot exceed 50 characters'
        }),
        batch_number: joi_1.default.string()
            .trim()
            .min(1)
            .max(100)
            .optional()
            .messages({
            'string.empty': 'Batch number cannot be empty (used as identifier)',
            'string.min': 'Batch number must be at least 1 character',
            'string.max': 'Batch number cannot exceed 100 characters'
        }),
        usage_type: joi_1.default.string()
            .valid(...USAGE_TYPES)
            .optional()
            .messages({
            'any.only': 'Usage type must be one of: bait_inspection, fumigation, or multi_purpose'
        }),
        safety_information: joi_1.default.string()
            .trim()
            .allow(null, '')
            .optional()
            .messages({
            'string.empty': 'Safety information cannot be empty if provided'
        })
    }).min(1).messages({
        'object.min': 'At least one field must be provided for update'
    });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Chemical update validation failed', {
            errors,
            chemical_id: req.params.id,
            user_id: req.user?.id
        });
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
        return;
    }
    req.body = value;
    next();
};
exports.validateChemicalUpdate = validateChemicalUpdate;
const validateChemicalStatus = (req, res, next) => {
    const schema = joi_1.default.object({
        status: joi_1.default.string()
            .valid(...STATUSES)
            .required()
            .messages({
            'any.only': 'Status must be either active or inactive',
            'any.required': 'Status is required'
        })
    });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Chemical status validation failed', {
            errors,
            chemical_id: req.params.id,
            user_id: req.user?.id
        });
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
        return;
    }
    req.body = value;
    next();
};
exports.validateChemicalStatus = validateChemicalStatus;
const validateChemicalListParams = (req, res, next) => {
    const schema = joi_1.default.object({
        page: joi_1.default.number()
            .integer()
            .min(1)
            .default(1)
            .optional()
            .messages({
            'number.base': 'Page must be a number',
            'number.integer': 'Page must be an integer',
            'number.min': 'Page must be at least 1'
        }),
        limit: joi_1.default.number()
            .integer()
            .min(1)
            .max(100)
            .default(25)
            .optional()
            .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),
        usage_type: joi_1.default.string()
            .valid(...USAGE_TYPES, 'all')
            .default('all')
            .optional()
            .messages({
            'any.only': 'Usage type must be one of: bait_inspection, fumigation, multi_purpose, or all'
        }),
        status: joi_1.default.string()
            .valid(...STATUSES, 'all')
            .default('all')
            .optional()
            .messages({
            'any.only': 'Status must be either active, inactive, or all'
        }),
        search: joi_1.default.string()
            .trim()
            .min(1)
            .max(200)
            .optional()
            .messages({
            'string.min': 'Search query must be at least 1 character',
            'string.max': 'Search query cannot exceed 200 characters'
        })
    });
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Chemical list params validation failed', {
            errors,
            user_id: req.user?.id
        });
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
        return;
    }
    req.query = value;
    next();
};
exports.validateChemicalListParams = validateChemicalListParams;
const validateChemicalSearch = (req, res, next) => {
    const schema = joi_1.default.object({
        q: joi_1.default.string()
            .trim()
            .min(2)
            .max(200)
            .required()
            .messages({
            'string.empty': 'Search query is required',
            'string.min': 'Search query must be at least 2 characters',
            'string.max': 'Search query cannot exceed 200 characters',
            'any.required': 'Search query is required'
        }),
        usage_type: joi_1.default.string()
            .valid(...USAGE_TYPES, 'all')
            .default('all')
            .optional()
            .messages({
            'any.only': 'Usage type must be one of: bait_inspection, fumigation, multi_purpose, or all'
        }),
        status: joi_1.default.string()
            .valid(...STATUSES, 'all')
            .default('active')
            .optional()
            .messages({
            'any.only': 'Status must be either active, inactive, or all'
        }),
        limit: joi_1.default.number()
            .integer()
            .min(1)
            .max(100)
            .default(20)
            .optional()
            .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        })
    });
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Chemical search validation failed', {
            errors,
            user_id: req.user?.id
        });
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
        return;
    }
    req.query = value;
    next();
};
exports.validateChemicalSearch = validateChemicalSearch;
exports.default = {
    validateChemicalInput: exports.validateChemicalInput,
    validateChemicalUpdate: exports.validateChemicalUpdate,
    validateChemicalStatus: exports.validateChemicalStatus,
    validateChemicalListParams: exports.validateChemicalListParams,
    validateChemicalSearch: exports.validateChemicalSearch
};
//# sourceMappingURL=chemicalValidation.js.map