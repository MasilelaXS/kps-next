/**
 * KPS Pest Control Management System - Chemical Validation Middleware
 * 
 * Joi validation schemas for chemical operations
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../config/logger';

// Valid chemical usage types
const USAGE_TYPES = ['bait_inspection', 'fumigation', 'multi_purpose'];

// Valid statuses
const STATUSES = ['active', 'inactive'];

/**
 * Validate chemical creation input
 */
export const validateChemicalInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    name: Joi.string()
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

    active_ingredients: Joi.string()
      .trim()
      .min(2)
      .required()
      .messages({
        'string.empty': 'Active ingredients are required',
        'string.min': 'Active ingredients must be at least 2 characters',
        'any.required': 'Active ingredients are required'
      }),

    quantity_unit: Joi.string()
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

    l_number: Joi.string()
      .trim()
      .max(50)
      .allow(null, '')
      .optional()
      .messages({
        'string.max': 'L number cannot exceed 50 characters'
      }),

    batch_number: Joi.string()
      .trim()
      .max(100)
      .allow(null, '')
      .optional()
      .messages({
        'string.max': 'Batch number cannot exceed 100 characters'
      }),

    usage_type: Joi.string()
      .valid(...USAGE_TYPES)
      .required()
      .messages({
        'any.only': 'Usage type must be one of: bait_inspection, fumigation, or multi_purpose',
        'any.required': 'Usage type is required'
      }),

    safety_information: Joi.string()
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

    logger.warn('Chemical validation failed', { 
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

  // Update request body with validated values
  req.body = value;
  next();
};

/**
 * Validate chemical update input
 */
export const validateChemicalUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(200)
      .optional()
      .messages({
        'string.empty': 'Chemical name cannot be empty',
        'string.min': 'Chemical name must be at least 2 characters',
        'string.max': 'Chemical name cannot exceed 200 characters'
      }),

    active_ingredients: Joi.string()
      .trim()
      .min(2)
      .optional()
      .messages({
        'string.empty': 'Active ingredients cannot be empty',
        'string.min': 'Active ingredients must be at least 2 characters'
      }),

    quantity_unit: Joi.string()
      .trim()
      .min(1)
      .max(20)
      .optional()
      .messages({
        'string.empty': 'Quantity unit cannot be empty',
        'string.min': 'Quantity unit must be at least 1 character',
        'string.max': 'Quantity unit cannot exceed 20 characters'
      }),

    l_number: Joi.string()
      .trim()
      .max(50)
      .allow(null, '')
      .optional()
      .messages({
        'string.max': 'L number cannot exceed 50 characters'
      }),

    batch_number: Joi.string()
      .trim()
      .max(100)
      .allow(null, '')
      .optional()
      .messages({
        'string.max': 'Batch number cannot exceed 100 characters'
      }),

    usage_type: Joi.string()
      .valid(...USAGE_TYPES)
      .optional()
      .messages({
        'any.only': 'Usage type must be one of: bait_inspection, fumigation, or multi_purpose'
      }),

    safety_information: Joi.string()
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

    logger.warn('Chemical update validation failed', { 
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

/**
 * Validate chemical status update
 */
export const validateChemicalStatus = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    status: Joi.string()
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

    logger.warn('Chemical status validation failed', { 
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

/**
 * Validate chemical list query parameters
 */
export const validateChemicalListParams = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .optional()
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),

    limit: Joi.number()
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

    usage_type: Joi.string()
      .valid(...USAGE_TYPES, 'all')
      .default('all')
      .optional()
      .messages({
        'any.only': 'Usage type must be one of: bait_inspection, fumigation, multi_purpose, or all'
      }),

    status: Joi.string()
      .valid(...STATUSES, 'all')
      .default('all')
      .optional()
      .messages({
        'any.only': 'Status must be either active, inactive, or all'
      }),

    search: Joi.string()
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

    logger.warn('Chemical list params validation failed', { 
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

/**
 * Validate chemical search query parameters
 */
export const validateChemicalSearch = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    q: Joi.string()
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

    usage_type: Joi.string()
      .valid(...USAGE_TYPES, 'all')
      .default('all')
      .optional()
      .messages({
        'any.only': 'Usage type must be one of: bait_inspection, fumigation, multi_purpose, or all'
      }),

    status: Joi.string()
      .valid(...STATUSES, 'all')
      .default('active')
      .optional()
      .messages({
        'any.only': 'Status must be either active, inactive, or all'
      }),

    limit: Joi.number()
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

    logger.warn('Chemical search validation failed', { 
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

export default {
  validateChemicalInput,
  validateChemicalUpdate,
  validateChemicalStatus,
  validateChemicalListParams,
  validateChemicalSearch
};
