/**
 * KPS Pest Control Management System - Version Validation Middleware
 * 
 * Joi validation schemas for version management endpoints
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Semantic version validation schema
const semanticVersionSchema = Joi.string()
  .pattern(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/)
  .required()
  .messages({
    'string.pattern.base': 'Version must follow semantic versioning format (e.g., 1.0.0, 2.1.3-beta)',
    'any.required': 'Version is required'
  });

// Platform validation schema
const platformSchema = Joi.string()
  .valid('android', 'ios', 'both')
  .default('both')
  .messages({
    'any.only': 'Platform must be one of: android, ios, both'
  });

// Release notes schema
const releaseNotesSchema = Joi.string()
  .min(10)
  .max(1000)
  .optional()
  .messages({
    'string.min': 'Release notes must be at least 10 characters long',
    'string.max': 'Release notes cannot exceed 1000 characters'
  });

/**
 * Validate version input for new version releases
 */
export const validateVersionInput = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    version: semanticVersionSchema,
    platform: platformSchema,
    force_update: Joi.boolean().default(false),
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

  // Replace request body with validated and sanitized data
  req.body = value;
  next();
};

/**
 * Validate version query parameters for current version endpoint
 */
export const validateVersionQuery = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    platform: Joi.string().valid('android', 'ios', 'both').optional(),
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

  // Replace query with validated data
  req.query = value;
  next();
};

/**
 * Validate version status update
 */
export const validateVersionStatusUpdate = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    is_active: Joi.boolean().required().messages({
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

/**
 * Validate version ID parameter
 */
export const validateVersionId = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    id: Joi.number().integer().positive().required().messages({
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

/**
 * Generic validation middleware factory
 * Creates validation middleware from a Joi schema
 * 
 * @param schema - Joi validation schema
 * @param source - Where to validate ('body', 'query', 'params')
 */
export const validateRequest = (schema: Joi.Schema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

    // Update request with validated data
    (req as any)[source] = value;
    next();
  };
};