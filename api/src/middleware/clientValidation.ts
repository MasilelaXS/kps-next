/**
 * KPS Pest Control Management System - Client Validation Middleware
 * 
 * Joi validation schemas for client management operations
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../config/logger';

// Validation schemas
const clientInputSchema = Joi.object({
  company_name: Joi.string().trim().min(2).max(255).required()
    .messages({
      'string.empty': 'Company name is required',
      'string.min': 'Company name must be at least 2 characters',
      'string.max': 'Company name cannot exceed 255 characters'
    }),
  
  address_line1: Joi.string().trim().min(5).max(255).required()
    .messages({
      'string.empty': 'Address line 1 is required',
      'string.min': 'Address must be at least 5 characters',
      'string.max': 'Address line 1 cannot exceed 255 characters'
    }),
  
  address_line2: Joi.string().trim().max(255).allow('', null).optional(),
  
  city: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'City is required',
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 100 characters'
    }),
  
  state: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'State/Province is required',
      'string.min': 'State must be at least 2 characters',
      'string.max': 'State cannot exceed 100 characters'
    }),
  
  postal_code: Joi.string().trim().min(3).max(20).required()
    .messages({
      'string.empty': 'Postal code is required',
      'string.min': 'Postal code must be at least 3 characters',
      'string.max': 'Postal code cannot exceed 20 characters'
    }),
  
  contacts: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().min(2).max(100).required()
        .messages({
          'string.empty': 'Contact name is required',
          'string.min': 'Contact name must be at least 2 characters'
        }),
      
      role: Joi.string().valid('primary', 'billing', 'site_manager', 'emergency', 'other').required()
        .messages({
          'any.only': 'Contact role must be one of: primary, billing, site_manager, emergency, other'
        }),
      
      phone: Joi.string().trim().pattern(/^[\+]?[\s\-\(\)0-9]{10,20}$/).allow('', null).optional()
        .messages({
          'string.pattern.base': 'Contact phone number format is invalid'
        }),
      
      email: Joi.string().trim().email().max(255).allow('', null).optional()
        .messages({
          'string.email': 'Contact email format is invalid'
        }),
      
      is_primary: Joi.boolean().optional().default(false)
    })
  ).optional().default([])
});

const clientUpdateSchema = Joi.object({
  company_name: Joi.string().trim().min(2).max(255).optional()
    .messages({
      'string.min': 'Company name must be at least 2 characters',
      'string.max': 'Company name cannot exceed 255 characters'
    }),
  
  address_line1: Joi.string().trim().min(5).max(255).optional()
    .messages({
      'string.min': 'Address must be at least 5 characters',
      'string.max': 'Address line 1 cannot exceed 255 characters'
    }),
  
  address_line2: Joi.string().trim().max(255).allow('', null).optional(),
  
  city: Joi.string().trim().min(2).max(100).optional()
    .messages({
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 100 characters'
    }),
  
  state: Joi.string().trim().min(2).max(100).optional()
    .messages({
      'string.min': 'State must be at least 2 characters',
      'string.max': 'State cannot exceed 100 characters'
    }),
  
  postal_code: Joi.string().trim().min(3).max(20).optional()
    .messages({
      'string.min': 'Postal code must be at least 3 characters',
      'string.max': 'Postal code cannot exceed 20 characters'
    }),
  
  // Station and monitor counts
  total_bait_stations_inside: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'Inside bait stations must be a number',
      'number.integer': 'Inside bait stations must be a whole number',
      'number.min': 'Inside bait stations cannot be negative'
    }),
  
  total_bait_stations_outside: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'Outside bait stations must be a number',
      'number.integer': 'Outside bait stations must be a whole number',
      'number.min': 'Outside bait stations cannot be negative'
    }),
  
  total_insect_monitors_light: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'Light insect monitors must be a number',
      'number.integer': 'Light insect monitors must be a whole number',
      'number.min': 'Light insect monitors cannot be negative'
    }),
  
  total_insect_monitors_box: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'Box insect monitors must be a number',
      'number.integer': 'Box insect monitors must be a whole number',
      'number.min': 'Box insect monitors cannot be negative'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const clientStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended').required()
    .messages({
      'any.only': 'Status must be one of: active, inactive, suspended',
      'any.required': 'Status is required'
    })
});

const clientSearchSchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'Search query is required',
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters'
    }),
  
  status: Joi.string().valid('all', 'active', 'inactive', 'suspended').optional().default('all'),
  
  pco_id: Joi.alternatives().try(
    Joi.string().valid('all'),
    Joi.number().integer().positive()
  ).optional().default('all'),
  
  limit: Joi.number().integer().min(1).max(50).optional().default(10)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    })
});

const clientListParamsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1)
    .messages({
      'number.min': 'Page must be at least 1'
    }),
  
  limit: Joi.number().integer().min(1).max(100).optional().default(25)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  
  status: Joi.string().valid('all', 'active', 'inactive', 'suspended').optional().default('all'),
  
  pco_id: Joi.alternatives().try(
    Joi.string().valid('all'),
    Joi.number().integer().positive()
  ).optional().default('all'),
  
  search: Joi.string().trim().min(2).max(100).allow('').optional()
    .messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters'
    })
});

const contactInputSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'Contact name is required',
      'string.min': 'Contact name must be at least 2 characters',
      'string.max': 'Contact name cannot exceed 100 characters'
    }),
  
  role: Joi.string().valid('primary', 'billing', 'site_manager', 'emergency', 'other').required()
    .messages({
      'any.only': 'Contact role must be one of: primary, billing, site_manager, emergency, other',
      'any.required': 'Contact role is required'
    }),
  
  phone: Joi.string().trim().pattern(/^[\+]?[\s\-\(\)0-9]{10,20}$/).allow('', null).optional()
    .messages({
      'string.pattern.base': 'Phone number format is invalid'
    }),
  
  email: Joi.string().trim().email().max(255).allow('', null).optional()
    .messages({
      'string.email': 'Email format is invalid',
      'string.max': 'Email cannot exceed 255 characters'
    }),
  
  is_primary: Joi.boolean().optional().default(false)
});

const contactUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional()
    .messages({
      'string.min': 'Contact name must be at least 2 characters',
      'string.max': 'Contact name cannot exceed 100 characters'
    }),
  
  role: Joi.string().valid('primary', 'billing', 'site_manager', 'emergency', 'other').optional()
    .messages({
      'any.only': 'Contact role must be one of: primary, billing, site_manager, emergency, other'
    }),
  
  phone: Joi.string().trim().pattern(/^[\+]?[\s\-\(\)0-9]{10,20}$/).allow('', null).optional()
    .messages({
      'string.pattern.base': 'Phone number format is invalid'
    }),
  
  email: Joi.string().trim().email().max(255).allow('', null).optional()
    .messages({
      'string.email': 'Email format is invalid',
      'string.max': 'Email cannot exceed 255 characters'
    }),
  
  is_primary: Joi.boolean().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Validation middleware functions
export const validateClientInput = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = clientInputSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    logger.warn('Client input validation failed', {
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

export const validateClientUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = clientUpdateSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    logger.warn('Client update validation failed', {
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

export const validateClientStatus = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = clientStatusSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    logger.warn('Client status validation failed', {
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

export const validateClientSearch = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = clientSearchSchema.validate(req.query, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    logger.warn('Client search validation failed', {
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

  req.query = value as any;
  next();
};

export const validateClientListParams = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = clientListParamsSchema.validate(req.query, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    logger.warn('Client list params validation failed', {
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

  req.query = value as any;
  next();
};

export const validateContactInput = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = contactInputSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    logger.warn('Contact input validation failed', {
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

export const validateContactUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = contactUpdateSchema.validate(req.body, { 
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    logger.warn('Contact update validation failed', {
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