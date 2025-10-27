/**
 * Validation schemas for PCO Sync & Offline Data endpoints
 * Phase 4.2 - Mobile offline support
 */

import Joi from 'joi';

/**
 * Schema for sync query parameters (timestamp filtering)
 * Used by: syncClients, syncChemicals, syncRecentReports
 */
export const syncQuerySchema = Joi.object({
  since: Joi.date().iso().optional()
    .description('Timestamp to filter updates - only return items modified after this time'),
  
  client_id: Joi.number().integer().positive().optional()
    .description('Filter by specific client ID'),
  
  include_contacts: Joi.boolean().optional().default(true)
    .description('Include client contacts in response')
});

/**
 * Schema for batch report upload
 * Used by: uploadReports
 */
export const uploadReportsSchema = Joi.object({
  reports: Joi.array().items(
    Joi.object({
      local_id: Joi.string().required()
        .description('Local database ID for mapping to server ID'),
      
      client_id: Joi.number().integer().positive().required()
        .description('Client ID (must be actively assigned to PCO)'),
      
      report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both').required()
        .description('Type of pest control service'),
      
      service_date: Joi.date().iso().max('now').required()
        .description('Date service was performed'),
      
      next_service_date: Joi.date().iso().min(Joi.ref('service_date')).optional().allow(null)
        .description('Recommended next service date'),
      
      pco_signature_data: Joi.string().required()
        .description('Base64 encoded signature image'),
      
      client_signature_data: Joi.string().required()
        .description('Base64 encoded client signature'),
      
      client_signature_name: Joi.string().max(100).required()
        .description('Name of person who signed'),
      
      general_remarks: Joi.string().max(1000).optional().allow(null)
        .description('General remarks about the service'),
      
      // Bait stations (for baiting reports)
      bait_stations: Joi.array().items(
        Joi.object({
          station_number: Joi.string().max(50).required(),
          location: Joi.string().valid('inside', 'outside').required(),
          is_accessible: Joi.number().integer().valid(0, 1).default(1),
          inaccessible_reason: Joi.string().max(255).optional().allow(null),
          activity_detected: Joi.number().integer().valid(0, 1).default(0),
          activity_droppings: Joi.number().integer().valid(0, 1).default(0),
          activity_gnawing: Joi.number().integer().valid(0, 1).default(0),
          activity_tracks: Joi.number().integer().valid(0, 1).default(0),
          activity_other: Joi.number().integer().valid(0, 1).default(0),
          activity_other_description: Joi.string().max(255).optional().allow(null),
          bait_status: Joi.string().valid('clean', 'eaten', 'wet', 'old').default('clean'),
          station_condition: Joi.string().valid('good', 'needs_repair', 'damaged', 'missing').default('good'),
          action_taken: Joi.string().valid('repaired', 'replaced', 'none').default('none'),
          warning_sign_condition: Joi.string().valid('good', 'replaced', 'repaired', 'remounted').default('good'),
          rodent_box_replaced: Joi.number().integer().valid(0, 1).default(0),
          station_remarks: Joi.string().max(500).optional().allow(null),
          chemicals: Joi.array().items(
            Joi.object({
              chemical_id: Joi.number().integer().positive().required(),
              quantity: Joi.number().positive().required(),
              batch_number: Joi.string().max(100).optional().allow(null)
            })
          ).optional()
        })
      ).optional(),
      
      // Fumigation data (for fumigation reports)
      fumigation: Joi.object({
        areas: Joi.array().items(
          Joi.object({
            area_name: Joi.string().max(100).required(),
            is_other: Joi.number().integer().valid(0, 1).default(0),
            other_description: Joi.string().max(255).optional().allow(null)
          })
        ).optional(),
        
        target_pests: Joi.array().items(
          Joi.object({
            pest_name: Joi.string().max(100).required(),
            is_other: Joi.number().integer().valid(0, 1).default(0),
            other_description: Joi.string().max(255).optional().allow(null)
          })
        ).optional(),
        
        chemicals: Joi.array().items(
          Joi.object({
            chemical_id: Joi.number().integer().positive().required(),
            quantity: Joi.number().positive().required(),
            batch_number: Joi.string().max(100).optional().allow(null)
          })
        ).optional()
      }).optional(),
      
      // Insect monitors (for monitoring reports)
      insect_monitors: Joi.array().items(
        Joi.object({
          monitor_type: Joi.string().valid('box', 'light').required(),
          monitor_condition: Joi.string().valid('good', 'replaced', 'repaired', 'other').default('good'),
          monitor_condition_other: Joi.string().max(255).optional().allow(null),
          warning_sign_condition: Joi.string().valid('good', 'replaced', 'repaired', 'remounted').default('good'),
          light_condition: Joi.string().valid('good', 'faulty', 'na').default('na'),
          light_faulty_type: Joi.string().valid('starter', 'tube', 'cable', 'electricity', 'other', 'na').default('na'),
          light_faulty_other: Joi.string().max(255).optional().allow(null),
          glue_board_replaced: Joi.number().integer().valid(0, 1).default(0),
          tubes_replaced: Joi.number().integer().valid(0, 1).optional().allow(null),
          monitor_serviced: Joi.number().integer().valid(0, 1).default(0)
        })
      ).optional()
    })
  ).min(1).max(50).required()
    .description('Array of reports to upload (max 50 per batch)')
});

/**
 * Schema for data export query parameters
 * Used by: exportData
 */
export const exportQuerySchema = Joi.object({
  format: Joi.string().valid('json').default('json')
    .description('Export format (only json supported currently)')
});

/**
 * Schema for updating client station/monitor counts
 * Used by: updateClientCounts
 */
export const updateClientCountsSchema = Joi.object({
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
      'number.base': 'Light monitors must be a number',
      'number.integer': 'Light monitors must be a whole number',
      'number.min': 'Light monitors cannot be negative'
    }),
  
  total_insect_monitors_box: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'Box monitors must be a number',
      'number.integer': 'Box monitors must be a whole number',
      'number.min': 'Box monitors cannot be negative'
    })
}).min(1).messages({
  'object.min': 'At least one count field must be provided'
});
