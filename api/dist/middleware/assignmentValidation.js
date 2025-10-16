"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAssignmentListParams = exports.validateBulkUnassign = exports.validateBulkAssign = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../config/logger");
const validateBulkAssign = (req, res, next) => {
    const schema = joi_1.default.object({
        pco_id: joi_1.default.number()
            .integer()
            .positive()
            .required()
            .messages({
            'number.base': 'PCO ID must be a number',
            'number.integer': 'PCO ID must be an integer',
            'number.positive': 'PCO ID must be positive',
            'any.required': 'PCO ID is required'
        }),
        client_ids: joi_1.default.array()
            .items(joi_1.default.number().integer().positive())
            .min(1)
            .max(100)
            .required()
            .messages({
            'array.base': 'Client IDs must be an array',
            'array.min': 'At least one client ID is required',
            'array.max': 'Cannot assign more than 100 clients at once',
            'any.required': 'Client IDs are required'
        })
    });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Bulk assign validation failed', {
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
exports.validateBulkAssign = validateBulkAssign;
const validateBulkUnassign = (req, res, next) => {
    const schema = joi_1.default.object({
        assignment_ids: joi_1.default.array()
            .items(joi_1.default.number().integer().positive())
            .min(1)
            .max(100)
            .required()
            .messages({
            'array.base': 'Assignment IDs must be an array',
            'array.min': 'At least one assignment ID is required',
            'array.max': 'Cannot unassign more than 100 assignments at once',
            'any.required': 'Assignment IDs are required'
        })
    });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Bulk unassign validation failed', {
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
exports.validateBulkUnassign = validateBulkUnassign;
const validateAssignmentListParams = (req, res, next) => {
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
        pco_id: joi_1.default.number()
            .integer()
            .positive()
            .optional()
            .messages({
            'number.base': 'PCO ID must be a number',
            'number.integer': 'PCO ID must be an integer',
            'number.positive': 'PCO ID must be positive'
        }),
        client_id: joi_1.default.number()
            .integer()
            .positive()
            .optional()
            .messages({
            'number.base': 'Client ID must be a number',
            'number.integer': 'Client ID must be an integer',
            'number.positive': 'Client ID must be positive'
        }),
        status: joi_1.default.string()
            .valid('active', 'inactive', 'all')
            .default('active')
            .optional()
            .messages({
            'any.only': 'Status must be either active, inactive, or all'
        })
    });
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));
        logger_1.logger.warn('Assignment list params validation failed', {
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
exports.validateAssignmentListParams = validateAssignmentListParams;
exports.default = {
    validateBulkAssign: exports.validateBulkAssign,
    validateBulkUnassign: exports.validateBulkUnassign,
    validateAssignmentListParams: exports.validateAssignmentListParams
};
//# sourceMappingURL=assignmentValidation.js.map