/**
 * Report Management Validation Schemas
 * Phase 3.2 - Comprehensive Joi validation for all report operations
 */

import Joi from 'joi';

// ============================================================================
// QUERY PARAMETER SCHEMAS
// ============================================================================

export const reportListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  client_id: Joi.number().integer().optional(),
  pco_id: Joi.number().integer().optional(),
  status: Joi.string().valid('draft', 'pending', 'approved', 'declined', 'archived', 'all').optional(),
  status_group: Joi.string().valid('draft', 'pending', 'approved', 'declined', 'emailed', 'archived', 'all').optional(),
  report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both', 'all').optional(),
  search: Joi.string().optional(),
  date_from: Joi.date().optional(),
  date_to: Joi.date().optional()
});

// ============================================================================
// CORE REPORT SCHEMAS
// ============================================================================

export const createReportSchema = Joi.object({
  client_id: Joi.number().integer().required()
    .messages({
      'any.required': 'Client ID is required',
      'number.base': 'Client ID must be a number'
    }),
  
  report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both').required()
    .messages({
      'any.required': 'Report type is required',
      'any.only': 'Report type must be one of: bait_inspection, fumigation, both'
    }),
  
  service_date: Joi.date().max('now').required()
    .messages({
      'any.required': 'Service date is required',
      'date.max': 'Service date cannot be in the future'
    }),
  
  next_service_date: Joi.date().greater(Joi.ref('service_date')).optional()
    .messages({
      'date.greater': 'Next service date must be after service date'
    }),
  
  pco_signature_data: Joi.string().optional().allow(null, ''),
  general_remarks: Joi.string().max(5000).optional().allow(null, '')
});

export const updateReportSchema = Joi.object({
  report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both').optional(),
  service_date: Joi.date().max('now').optional(),
  next_service_date: Joi.date().optional(),
  pco_signature_data: Joi.string().optional().allow(null, ''),
  client_signature_data: Joi.string().optional().allow(null, ''),
  client_signature_name: Joi.string().max(100).optional().allow(null, ''),
  general_remarks: Joi.string().max(5000).optional().allow(null, '')
  // Note: 'recommendations' is admin-only field, not allowed here
});

export const submitReportSchema = Joi.object({
  // No body required - all validation done in controller
});

export const approveReportSchema = Joi.object({
  admin_notes: Joi.string().max(5000).optional().allow(null, ''),
  recommendations: Joi.string().max(5000).optional().allow(null, '')
    .messages({
      'string.max': 'Recommendations must not exceed 5000 characters'
    })
});

export const declineReportSchema = Joi.object({
  admin_notes: Joi.string().min(10).max(5000).required()
    .messages({
      'any.required': 'Admin notes are required when declining a report',
      'string.min': 'Admin notes must be at least 10 characters (PCO needs clear feedback for revision)',
      'string.empty': 'Admin notes cannot be empty when declining a report'
    })
});

// ============================================================================
// BAIT STATION SCHEMAS
// ============================================================================

const baitStationChemicalSchema = Joi.object({
  chemical_id: Joi.number().integer().required()
    .messages({
      'any.required': 'Chemical ID is required',
      'number.base': 'Chemical ID must be a number'
    }),
  
  quantity: Joi.number().positive().precision(2).required()
    .messages({
      'any.required': 'Chemical quantity is required',
      'number.positive': 'Quantity must be greater than 0'
    }),
  
  batch_number: Joi.string().max(50).optional().allow(null, '')
});

export const addBaitStationSchema = Joi.object({
  station_number: Joi.string().max(20).required()
    .messages({
      'any.required': 'Station number is required',
      'string.base': 'Station number must be a string',
      'string.max': 'Station number must not exceed 20 characters'
    }),
  
  location: Joi.string().valid('inside', 'outside').required()
    .messages({
      'any.required': 'Location is required',
      'any.only': 'Location must be either inside or outside'
    }),
  
  is_accessible: Joi.boolean().required()
    .messages({
      'any.required': 'Accessibility status is required'
    }),
  
  inaccessible_reason: Joi.string().max(255).optional().allow(null, '')
    .when('is_accessible', {
      is: false,
      then: Joi.required().messages({
        'any.required': 'Inaccessible reason is required when station is not accessible'
      })
    }),
  
  activity_detected: Joi.boolean().required(),
  activity_droppings: Joi.boolean().optional().default(false),
  activity_gnawing: Joi.boolean().optional().default(false),
  activity_tracks: Joi.boolean().optional().default(false),
  activity_other: Joi.boolean().optional().default(false),
  
  activity_other_description: Joi.string().max(255).optional().allow(null, '')
    .when('activity_other', {
      is: true,
      then: Joi.required().messages({
        'any.required': 'Description is required when "other activity" is selected'
      })
    }),
  
  bait_status: Joi.string().valid('clean', 'eaten', 'wet', 'old').required()
    .messages({
      'any.required': 'Bait status is required',
      'any.only': 'Bait status must be one of: clean, eaten, wet, old'
    }),
  
  station_condition: Joi.string().valid('good', 'needs_repair', 'damaged', 'missing').required()
    .messages({
      'any.required': 'Station condition is required',
      'any.only': 'Station condition must be one of: good, needs_repair, damaged, missing'
    }),
  
  action_taken: Joi.string().valid('repaired', 'replaced', 'none').optional().default('none')
    .when('station_condition', {
      is: Joi.string().valid('needs_repair', 'damaged', 'missing'),
      then: Joi.valid('repaired', 'replaced').required().messages({
        'any.required': 'Action taken is required when station needs repair, is damaged, or missing'
      })
    }),
  
  warning_sign_condition: Joi.string().valid('good', 'replaced', 'repaired', 'remounted').required()
    .messages({
      'any.required': 'Warning sign condition is required',
      'any.only': 'Warning sign condition must be one of: good, replaced, repaired, remounted'
    }),
  
  rodent_box_replaced: Joi.boolean().required(),
  station_remarks: Joi.string().max(5000).optional().allow(null, ''),
  
  chemicals: Joi.array().items(baitStationChemicalSchema).optional().default([])
});

export const updateBaitStationSchema = Joi.object({
  station_number: Joi.string().max(20).optional()
    .messages({
      'string.base': 'Station number must be a string',
      'string.max': 'Station number must not exceed 20 characters'
    }),
  location: Joi.string().valid('inside', 'outside').optional(),
  is_accessible: Joi.boolean().optional(),
  inaccessible_reason: Joi.string().max(255).optional().allow(null, ''),
  activity_detected: Joi.boolean().optional(),
  activity_droppings: Joi.boolean().optional(),
  activity_gnawing: Joi.boolean().optional(),
  activity_tracks: Joi.boolean().optional(),
  activity_other: Joi.boolean().optional(),
  activity_other_description: Joi.string().max(255).optional().allow(null, ''),
  bait_status: Joi.string().valid('clean', 'eaten', 'wet', 'old').optional(),
  station_condition: Joi.string().valid('good', 'needs_repair', 'damaged', 'missing').optional(),
  action_taken: Joi.string().valid('repaired', 'replaced', 'none').optional(),
  warning_sign_condition: Joi.string().valid('good', 'replaced', 'repaired', 'remounted').optional(),
  rodent_box_replaced: Joi.boolean().optional(),
  station_remarks: Joi.string().max(5000).optional().allow(null, ''),
  chemicals: Joi.array().items(baitStationChemicalSchema).optional()
});

// ============================================================================
// FUMIGATION SCHEMAS
// ============================================================================

const fumigationAreaSchema = Joi.object({
  area_name: Joi.string().max(100).required()
    .messages({
      'any.required': 'Area name is required',
      'string.max': 'Area name must not exceed 100 characters'
    }),
  
  is_other: Joi.boolean().optional().default(false),
  
  other_description: Joi.string().max(255).optional().allow(null, '')
    .when('is_other', {
      is: true,
      then: Joi.required().messages({
        'any.required': 'Description is required when "other" is selected'
      })
    })
});

const fumigationPestSchema = Joi.object({
  pest_name: Joi.string().max(100).required()
    .messages({
      'any.required': 'Pest name is required',
      'string.max': 'Pest name must not exceed 100 characters'
    }),
  
  is_other: Joi.boolean().optional().default(false),
  
  other_description: Joi.string().max(255).optional().allow(null, '')
    .when('is_other', {
      is: true,
      then: Joi.required().messages({
        'any.required': 'Description is required when "other" is selected'
      })
    })
});

const fumigationChemicalSchema = Joi.object({
  chemical_id: Joi.number().integer().required()
    .messages({
      'any.required': 'Chemical ID is required',
      'number.base': 'Chemical ID must be a number'
    }),
  
  quantity: Joi.number().positive().precision(2).required()
    .messages({
      'any.required': 'Chemical quantity is required',
      'number.positive': 'Quantity must be greater than 0'
    }),
  
  batch_number: Joi.string().max(50).optional().allow(null, '')
});

export const updateFumigationSchema = Joi.object({
  areas: Joi.array().items(fumigationAreaSchema).min(1).required()
    .messages({
      'any.required': 'At least one fumigation area is required',
      'array.min': 'At least one fumigation area is required'
    }),
  
  target_pests: Joi.array().items(fumigationPestSchema).min(1).required()
    .messages({
      'any.required': 'At least one target pest is required',
      'array.min': 'At least one target pest is required'
    }),
  
  chemicals: Joi.array().items(fumigationChemicalSchema).min(1).required()
    .messages({
      'any.required': 'At least one chemical is required',
      'array.min': 'At least one chemical is required'
    })
});

// ============================================================================
// INSECT MONITOR SCHEMAS
// ============================================================================

export const addInsectMonitorSchema = Joi.object({
  monitor_number: Joi.string().max(20).required()
    .messages({
      'any.required': 'Monitor number is required',
      'string.empty': 'Monitor number cannot be empty'
    }),
  
  location: Joi.string().max(100).required()
    .messages({
      'any.required': 'Monitor location is required',
      'string.empty': 'Monitor location cannot be empty'
    }),
  
  monitor_type: Joi.string().valid('box', 'light').required()
    .messages({
      'any.required': 'Monitor type is required',
      'any.only': 'Monitor type must be either box or light'
    }),
  
  monitor_condition: Joi.string().valid('good', 'replaced', 'repaired', 'other').required()
    .messages({
      'any.required': 'Monitor condition is required',
      'any.only': 'Monitor condition must be one of: good, replaced, repaired, other'
    }),
  
  monitor_condition_other: Joi.string().max(255).optional().allow(null, '')
    .when('monitor_condition', {
      is: 'other',
      then: Joi.required().messages({
        'any.required': 'Description is required when monitor condition is other'
      })
    }),
  
  warning_sign_condition: Joi.string().valid('good', 'replaced', 'repaired', 'remounted').required()
    .messages({
      'any.required': 'Warning sign condition is required',
      'any.only': 'Warning sign condition must be one of: good, replaced, repaired, remounted'
    }),
  
  light_condition: Joi.string().valid('good', 'faulty', 'na').optional().default('na')
    .when('monitor_type', {
      is: 'light',
      then: Joi.valid('good', 'faulty').required().messages({
        'any.required': 'Light condition is required for light monitors'
      })
    }),
  
  light_faulty_type: Joi.string().valid('starter', 'tube', 'cable', 'electricity', 'other', 'na').optional().default('na')
    .when('light_condition', {
      is: 'faulty',
      then: Joi.valid('starter', 'tube', 'cable', 'electricity', 'other').required().messages({
        'any.required': 'Light faulty type is required when light is faulty'
      })
    }),
  
  light_faulty_other: Joi.string().max(255).optional().allow(null, '')
    .when('light_faulty_type', {
      is: 'other',
      then: Joi.required().messages({
        'any.required': 'Description is required when light faulty type is other'
      })
    }),
  
  glue_board_replaced: Joi.boolean().required()
    .messages({
      'any.required': 'Glue board replacement status is required'
    }),
  
  tubes_replaced: Joi.boolean().optional().allow(null)
    .when('monitor_type', {
      is: 'light',
      then: Joi.required().messages({
        'any.required': 'Tubes replacement status is required for light monitors'
      })
    }),
  
  monitor_serviced: Joi.boolean().required()
    .messages({
      'any.required': 'Monitor serviced status is required'
    })
});

export const updateInsectMonitorSchema = Joi.object({
  monitor_number: Joi.string().max(20).optional(),
  location: Joi.string().max(100).optional(),
  monitor_type: Joi.string().valid('box', 'light').optional(),
  monitor_condition: Joi.string().valid('good', 'replaced', 'repaired', 'other').optional(),
  monitor_condition_other: Joi.string().max(255).optional().allow(null, ''),
  warning_sign_condition: Joi.string().valid('good', 'replaced', 'repaired', 'remounted').optional(),
  light_condition: Joi.string().valid('good', 'faulty', 'na').optional(),
  light_faulty_type: Joi.string().valid('starter', 'tube', 'cable', 'electricity', 'other', 'na').optional(),
  light_faulty_other: Joi.string().max(255).optional().allow(null, ''),
  glue_board_replaced: Joi.boolean().optional(),
  tubes_replaced: Joi.boolean().optional().allow(null),
  monitor_serviced: Joi.boolean().optional()
});

// ============================================================================
// COMPLETE REPORT SCHEMA (Single-request submission)
// ============================================================================

export const createCompleteReportSchema = Joi.object({
  client_id: Joi.number().integer().required(),
  report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both').required(),
  service_date: Joi.date().max('now').required(),
  next_service_date: Joi.date().greater(Joi.ref('service_date')).optional(),
  pco_signature_data: Joi.string().required(),
  client_signature_data: Joi.string().required(),
  client_signature_name: Joi.string().max(100).required(),
  general_remarks: Joi.string().max(5000).optional().allow(null, ''),
  
  bait_stations: Joi.array().items(Joi.object({
    station_number: Joi.string().max(20).required(),
    location: Joi.string().valid('inside', 'outside').required(),
    bait_status: Joi.string().valid('eaten', 'clean', 'wet', 'old').required(),
    is_accessible: Joi.boolean().required(),
    inaccessible_reason: Joi.string().max(255).optional().allow(null, ''),
    quantity_used: Joi.number().min(0).required(),
    chemicals: Joi.array().items(Joi.object({
      chemical_id: Joi.number().integer().required(),
      quantity: Joi.number().min(0).required(),
      batch_number: Joi.string().max(50).optional().allow(null, '')
    })).optional()
  })).optional(),
  
  fumigation: Joi.object({
    areas: Joi.array().items(Joi.object({
      area_name: Joi.string().max(100).required(),
      is_other: Joi.boolean().optional(),
      other_description: Joi.string().max(255).optional().allow(null, '')
    })).optional(),
    
    target_pests: Joi.array().items(Joi.object({
      pest_name: Joi.string().max(100).required(),
      is_other: Joi.boolean().optional(),
      other_description: Joi.string().max(255).optional().allow(null, '')
    })).optional(),
    
    chemicals: Joi.array().items(Joi.object({
      chemical_id: Joi.number().integer().required(),
      quantity: Joi.number().min(0).required(),
      batch_number: Joi.string().max(50).optional().allow(null, '')
    })).optional(),
    
    monitors: Joi.array().items(Joi.object({
      monitor_number: Joi.string().max(20).required(),
      location: Joi.string().max(100).required(),
      monitor_type: Joi.string().valid('box', 'light').required(),
      monitor_condition: Joi.string().valid('good', 'replaced', 'repaired', 'other').required(),
      monitor_condition_other: Joi.string().max(255).optional().allow(null, ''),
      warning_sign_condition: Joi.string().valid('good', 'replaced', 'repaired', 'remounted').required(),
      light_condition: Joi.string().valid('good', 'faulty', 'na').optional(),
      light_faulty_type: Joi.string().valid('starter', 'tube', 'cable', 'electricity', 'other', 'na').optional(),
      light_faulty_other: Joi.string().max(255).optional().allow(null, ''),
      glue_board_replaced: Joi.boolean().required(),
      tubes_replaced: Joi.boolean().optional().allow(null),
      monitor_serviced: Joi.boolean().optional()
    })).optional()
  }).optional()
});
