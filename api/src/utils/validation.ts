/**
 * KPS Pest Control Management System - Input Validation
 * 
 * Joi validation schemas for API endpoints
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import Joi from 'joi';

// Authentication Validation Schemas
export const loginSchema = Joi.object({
  login_id: Joi.string()
    .required()
    .pattern(/^(admin|pco)\d+$/)
    .messages({
      'any.required': 'Login ID is required',
      'string.empty': 'Login ID is required',
      'string.pattern.base': 'Login ID must be in format admin[number] or pco[number] (e.g., admin12345 or pco67890)'
    }),
  password: Joi.string()
    .required()
    .min(1)
    .messages({
      'any.required': 'Password is required',
      'string.empty': 'Password is required',
      'string.min': 'Password is required'
    })
});

export const changePasswordSchema = Joi.object({
  current_password: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required',
      'string.empty': 'Current password is required'
    }),
  new_password: Joi.string()
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

export const forgotPasswordSchema = Joi.object({
  login_id: Joi.string()
    .required()
    .pattern(/^(admin|pco)\d+$/)
    .messages({
      'any.required': 'Login ID is required',
      'string.empty': 'Login ID is required',
      'string.pattern.base': 'Login ID must be in format admin[number] or pco[number]'
    })
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .uuid()
    .messages({
      'any.required': 'Reset token is required',
      'string.empty': 'Reset token is required',
      'string.guid': 'Invalid reset token format'
    }),
  new_password: Joi.string()
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

export const profileUpdateSchema = Joi.object({
  first_name: Joi.string()
    .optional()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters',
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
    }),
  last_name: Joi.string()
    .optional()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters',
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
    }),
  email: Joi.string()
    .optional()
    .email()
    .max(100)
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.max': 'Email cannot exceed 100 characters'
    }),
  phone: Joi.string()
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

// Validation helper functions
export const validateLoginInput = (data: any) => {
  return loginSchema.validate(data, { abortEarly: false });
};

export const validateChangePasswordInput = (data: any) => {
  return changePasswordSchema.validate(data, { abortEarly: false });
};

export const validateForgotPasswordInput = (data: any) => {
  return forgotPasswordSchema.validate(data, { abortEarly: false });
};

export const validateResetPasswordInput = (data: any) => {
  return resetPasswordSchema.validate(data, { abortEarly: false });
};

export const validateProfileUpdateInput = (data: any) => {
  return profileUpdateSchema.validate(data, { abortEarly: false });
};

// Generic validation error formatter
export const formatValidationErrors = (error: Joi.ValidationError) => {
  return error.details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message,
    value: detail.context?.value
  }));
};

// Middleware for request validation
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatValidationErrors(error)
      });
    }
    
    req.validatedData = value;
    next();
  };
};