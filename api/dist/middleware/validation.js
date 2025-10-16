"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = exports.validateVersionId = exports.validateVersionStatusUpdate = exports.validateVersionQuery = exports.validateVersionInput = void 0;
const joi_1 = __importDefault(require("joi"));
const semanticVersionSchema = joi_1.default.string()
    .pattern(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/)
    .required()
    .messages({
    'string.pattern.base': 'Version must follow semantic versioning format (e.g., 1.0.0, 2.1.3-beta)',
    'any.required': 'Version is required'
});
const platformSchema = joi_1.default.string()
    .valid('android', 'ios', 'both')
    .default('both')
    .messages({
    'any.only': 'Platform must be one of: android, ios, both'
});
const releaseNotesSchema = joi_1.default.string()
    .min(10)
    .max(1000)
    .optional()
    .messages({
    'string.min': 'Release notes must be at least 10 characters long',
    'string.max': 'Release notes cannot exceed 1000 characters'
});
const validateVersionInput = (req, res, next) => {
    const schema = joi_1.default.object({
        version: semanticVersionSchema,
        platform: platformSchema,
        force_update: joi_1.default.boolean().default(false),
        release_notes: releaseNotesSchema
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
exports.validateVersionInput = validateVersionInput;
const validateVersionQuery = (req, res, next) => {
    const schema = joi_1.default.object({
        platform: joi_1.default.string().valid('android', 'ios', 'both').optional(),
        current_version: semanticVersionSchema.optional()
    });
    const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Invalid query parameters',
            errors: errorMessages
        });
        return;
    }
    req.query = value;
    next();
};
exports.validateVersionQuery = validateVersionQuery;
const validateVersionStatusUpdate = (req, res, next) => {
    const schema = joi_1.default.object({
        is_active: joi_1.default.boolean().required().messages({
            'any.required': 'is_active field is required',
            'boolean.base': 'is_active must be a boolean value'
        })
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
exports.validateVersionStatusUpdate = validateVersionStatusUpdate;
const validateVersionId = (req, res, next) => {
    const schema = joi_1.default.object({
        id: joi_1.default.number().integer().positive().required().messages({
            'number.base': 'Version ID must be a number',
            'number.integer': 'Version ID must be an integer',
            'number.positive': 'Version ID must be positive',
            'any.required': 'Version ID is required'
        })
    });
    const { error, value } = schema.validate(req.params, {
        abortEarly: false
    });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        res.status(400).json({
            success: false,
            message: 'Invalid version ID',
            errors: errorMessages
        });
        return;
    }
    req.params = value;
    next();
};
exports.validateVersionId = validateVersionId;
const validateRequest = (schema, source = 'body') => {
    return (req, res, next) => {
        const dataToValidate = req[source];
        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            res.status(400).json({
                success: false,
                message: `Validation failed for ${source}`,
                errors: errorMessages
            });
            return;
        }
        req[source] = value;
        next();
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validation.js.map