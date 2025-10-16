/**
 * KPS Pest Control Management System - User Validation Middleware
 * 
 * Joi validation schemas for user management endpoints
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// PCO number validation (can be auto-generated or custom)
const pcoNumberSchema = Joi.string()
  .pattern(/^[a-zA-Z0-9]+$/)
  .min(3)
  .max(20)
  .optional()
  .messages({
    'string.pattern.base': 'PCO number can only contain letters and numbers',
    'string.min': 'PCO number must be at least 3 characters long',
    'string.max': 'PCO number cannot exceed 20 characters'
  });

// Name validation
const nameSchema = Joi.string()
  .min(2)
  .max(100)
  .required()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required'
  });

// Email validation
const emailSchema = Joi.string()
  .email()
  .max(100)
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email cannot exceed 100 characters',
    'any.required': 'Email is required'
  });

// Phone validation (optional)
const phoneSchema = Joi.string()
  .pattern(/^[\+]?[1-9][\d\s\-\(\)]{7,15}$/)
  .optional()
  .allow(null, '')
  .messages({
    'string.pattern.base': 'Please provide a valid phone number'
  });

// Role validation
const roleSchema = Joi.string()
  .valid('admin', 'pco', 'both')
  .default('pco')
  .messages({
    'any.only': 'Role must be one of: admin, pco, both'
  });

// Status validation
const statusSchema = Joi.string()
  .valid('active', 'inactive')
  .required()
  .messages({
    'any.only': 'Status must be either active or inactive',
    'any.required': 'Status is required'
  });

// Password validation
const passwordSchema = Joi.string()
  .min(6)
  .max(100)
  .required()
  .messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password cannot exceed 100 characters',
    'any.required': 'Password is required'
  });

// ID parameter validation
const idSchema = Joi.number()
  .integer()
  .positive()
  .required()
  .messages({
    'number.base': 'User ID must be a number',
    'number.integer': 'User ID must be an integer',
    'number.positive': 'User ID must be positive',
    'any.required': 'User ID is required'
  });

/**
 * Validate user creation input
 */
export const validateUserInput = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
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

  // Replace request body with validated and sanitized data
  req.body = value;
  next();
};

/**
 * Validate user update input
 */
export const validateUserUpdate = (req: Request, res: Response, next: NextFunction) => {
  // Validate ID parameter first
  const idValidation = Joi.object({ id: idSchema }).validate(req.params);
  if (idValidation.error) {
    res.status(400).json({
      success: false,
      message: 'Invalid user ID',
      errors: idValidation.error.details.map(detail => detail.message)
    });
    return;
  }

  // Validate body (all fields optional for updates)
  const schema = Joi.object({
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

  // Ensure at least one field is being updated
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

/**
 * Validate user status update
 */
export const validateUserStatus = (req: Request, res: Response, next: NextFunction) => {
  // Validate ID parameter
  const idValidation = Joi.object({ id: idSchema }).validate(req.params);
  if (idValidation.error) {
    res.status(400).json({
      success: false,
      message: 'Invalid user ID',
      errors: idValidation.error.details.map(detail => detail.message)
    });
    return;
  }

  // Validate status
  const schema = Joi.object({
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

/**
 * Validate password reset
 */
export const validatePasswordReset = (req: Request, res: Response, next: NextFunction) => {
  // Validate ID parameter
  const idValidation = Joi.object({ id: idSchema }).validate(req.params);
  if (idValidation.error) {
    res.status(400).json({
      success: false,
      message: 'Invalid user ID',
      errors: idValidation.error.details.map(detail => detail.message)
    });
    return;
  }

  // Validate new password
  const schema = Joi.object({
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

/**
 * Validate user search parameters
 */
export const validateUserSearch = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    q: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 50 characters',
      'any.required': 'Search query (q) is required'
    }),
    role: Joi.string().valid('admin', 'pco', 'both', 'all').optional(),
    status: Joi.string().valid('active', 'inactive', 'all').optional(),
    limit: Joi.number().integer().min(1).max(50).optional().default(10).messages({
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

/**
 * Validate pagination parameters for user list
 */
export const validateUserListParams = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1).messages({
      'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).optional().default(25).messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
    role: Joi.string().valid('admin', 'pco', 'both', 'all').optional(),
    status: Joi.string().valid('active', 'inactive', 'all').optional(),
    search: Joi.string().min(2).max(50).optional().messages({
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