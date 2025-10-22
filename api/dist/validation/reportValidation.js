"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInsectMonitorSchema = exports.addInsectMonitorSchema = exports.updateFumigationSchema = exports.updateBaitStationSchema = exports.addBaitStationSchema = exports.declineReportSchema = exports.approveReportSchema = exports.submitReportSchema = exports.updateReportSchema = exports.createReportSchema = exports.reportListQuerySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.reportListQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    client_id: joi_1.default.number().integer().optional(),
    pco_id: joi_1.default.number().integer().optional(),
    status: joi_1.default.string().valid('draft', 'pending', 'approved', 'declined', 'archived', 'all').optional(),
    status_group: joi_1.default.string().valid('draft', 'approved', 'emailed', 'archived', 'all').optional(),
    report_type: joi_1.default.string().valid('bait_inspection', 'fumigation', 'both', 'all').optional(),
    search: joi_1.default.string().optional(),
    date_from: joi_1.default.date().optional(),
    date_to: joi_1.default.date().optional()
});
exports.createReportSchema = joi_1.default.object({
    client_id: joi_1.default.number().integer().required()
        .messages({
        'any.required': 'Client ID is required',
        'number.base': 'Client ID must be a number'
    }),
    report_type: joi_1.default.string().valid('bait_inspection', 'fumigation', 'both').required()
        .messages({
        'any.required': 'Report type is required',
        'any.only': 'Report type must be one of: bait_inspection, fumigation, both'
    }),
    service_date: joi_1.default.date().max('now').required()
        .messages({
        'any.required': 'Service date is required',
        'date.max': 'Service date cannot be in the future'
    }),
    next_service_date: joi_1.default.date().greater(joi_1.default.ref('service_date')).optional()
        .messages({
        'date.greater': 'Next service date must be after service date'
    }),
    pco_signature_data: joi_1.default.string().optional().allow(null, ''),
    general_remarks: joi_1.default.string().max(5000).optional().allow(null, '')
});
exports.updateReportSchema = joi_1.default.object({
    report_type: joi_1.default.string().valid('bait_inspection', 'fumigation', 'both').optional(),
    service_date: joi_1.default.date().max('now').optional(),
    next_service_date: joi_1.default.date().optional(),
    pco_signature_data: joi_1.default.string().optional().allow(null, ''),
    client_signature_data: joi_1.default.string().optional().allow(null, ''),
    client_signature_name: joi_1.default.string().max(100).optional().allow(null, ''),
    general_remarks: joi_1.default.string().max(5000).optional().allow(null, '')
});
exports.submitReportSchema = joi_1.default.object({});
exports.approveReportSchema = joi_1.default.object({
    admin_notes: joi_1.default.string().max(5000).optional().allow(null, ''),
    recommendations: joi_1.default.string().max(5000).optional().allow(null, '')
        .messages({
        'string.max': 'Recommendations must not exceed 5000 characters'
    })
});
exports.declineReportSchema = joi_1.default.object({
    admin_notes: joi_1.default.string().min(10).max(5000).required()
        .messages({
        'any.required': 'Admin notes are required when declining a report',
        'string.min': 'Admin notes must be at least 10 characters (PCO needs clear feedback for revision)',
        'string.empty': 'Admin notes cannot be empty when declining a report'
    })
});
const baitStationChemicalSchema = joi_1.default.object({
    chemical_id: joi_1.default.number().integer().required()
        .messages({
        'any.required': 'Chemical ID is required',
        'number.base': 'Chemical ID must be a number'
    }),
    quantity: joi_1.default.number().positive().precision(2).required()
        .messages({
        'any.required': 'Chemical quantity is required',
        'number.positive': 'Quantity must be greater than 0'
    }),
    batch_number: joi_1.default.string().max(50).optional().allow(null, '')
});
exports.addBaitStationSchema = joi_1.default.object({
    station_number: joi_1.default.string().max(20).required()
        .messages({
        'any.required': 'Station number is required',
        'string.max': 'Station number must not exceed 20 characters'
    }),
    location: joi_1.default.string().valid('inside', 'outside').required()
        .messages({
        'any.required': 'Location is required',
        'any.only': 'Location must be either inside or outside'
    }),
    is_accessible: joi_1.default.boolean().required()
        .messages({
        'any.required': 'Accessibility status is required'
    }),
    inaccessible_reason: joi_1.default.string().max(255).optional().allow(null, '')
        .when('is_accessible', {
        is: false,
        then: joi_1.default.required().messages({
            'any.required': 'Inaccessible reason is required when station is not accessible'
        })
    }),
    activity_detected: joi_1.default.boolean().required(),
    activity_droppings: joi_1.default.boolean().optional().default(false),
    activity_gnawing: joi_1.default.boolean().optional().default(false),
    activity_tracks: joi_1.default.boolean().optional().default(false),
    activity_other: joi_1.default.boolean().optional().default(false),
    activity_other_description: joi_1.default.string().max(255).optional().allow(null, '')
        .when('activity_other', {
        is: true,
        then: joi_1.default.required().messages({
            'any.required': 'Description is required when "other activity" is selected'
        })
    }),
    bait_status: joi_1.default.string().valid('clean', 'eaten', 'wet', 'old').required()
        .messages({
        'any.required': 'Bait status is required',
        'any.only': 'Bait status must be one of: clean, eaten, wet, old'
    }),
    station_condition: joi_1.default.string().valid('good', 'needs_repair', 'damaged', 'missing').required()
        .messages({
        'any.required': 'Station condition is required',
        'any.only': 'Station condition must be one of: good, needs_repair, damaged, missing'
    }),
    action_taken: joi_1.default.string().valid('repaired', 'replaced', 'none').optional().default('none')
        .when('station_condition', {
        is: joi_1.default.string().valid('needs_repair', 'damaged', 'missing'),
        then: joi_1.default.valid('repaired', 'replaced').required().messages({
            'any.required': 'Action taken is required when station needs repair, is damaged, or missing'
        })
    }),
    warning_sign_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'remounted').required()
        .messages({
        'any.required': 'Warning sign condition is required',
        'any.only': 'Warning sign condition must be one of: good, replaced, repaired, remounted'
    }),
    rodent_box_replaced: joi_1.default.boolean().required(),
    station_remarks: joi_1.default.string().max(5000).optional().allow(null, ''),
    chemicals: joi_1.default.array().items(baitStationChemicalSchema).optional().default([])
});
exports.updateBaitStationSchema = joi_1.default.object({
    station_number: joi_1.default.string().max(20).optional(),
    location: joi_1.default.string().valid('inside', 'outside').optional(),
    is_accessible: joi_1.default.boolean().optional(),
    inaccessible_reason: joi_1.default.string().max(255).optional().allow(null, ''),
    activity_detected: joi_1.default.boolean().optional(),
    activity_droppings: joi_1.default.boolean().optional(),
    activity_gnawing: joi_1.default.boolean().optional(),
    activity_tracks: joi_1.default.boolean().optional(),
    activity_other: joi_1.default.boolean().optional(),
    activity_other_description: joi_1.default.string().max(255).optional().allow(null, ''),
    bait_status: joi_1.default.string().valid('clean', 'eaten', 'wet', 'old').optional(),
    station_condition: joi_1.default.string().valid('good', 'needs_repair', 'damaged', 'missing').optional(),
    action_taken: joi_1.default.string().valid('repaired', 'replaced', 'none').optional(),
    warning_sign_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'remounted').optional(),
    rodent_box_replaced: joi_1.default.boolean().optional(),
    station_remarks: joi_1.default.string().max(5000).optional().allow(null, ''),
    chemicals: joi_1.default.array().items(baitStationChemicalSchema).optional()
});
const fumigationAreaSchema = joi_1.default.object({
    area_name: joi_1.default.string().max(100).required()
        .messages({
        'any.required': 'Area name is required',
        'string.max': 'Area name must not exceed 100 characters'
    }),
    is_other: joi_1.default.boolean().optional().default(false),
    other_description: joi_1.default.string().max(255).optional().allow(null, '')
        .when('is_other', {
        is: true,
        then: joi_1.default.required().messages({
            'any.required': 'Description is required when "other" is selected'
        })
    })
});
const fumigationPestSchema = joi_1.default.object({
    pest_name: joi_1.default.string().max(100).required()
        .messages({
        'any.required': 'Pest name is required',
        'string.max': 'Pest name must not exceed 100 characters'
    }),
    is_other: joi_1.default.boolean().optional().default(false),
    other_description: joi_1.default.string().max(255).optional().allow(null, '')
        .when('is_other', {
        is: true,
        then: joi_1.default.required().messages({
            'any.required': 'Description is required when "other" is selected'
        })
    })
});
const fumigationChemicalSchema = joi_1.default.object({
    chemical_id: joi_1.default.number().integer().required()
        .messages({
        'any.required': 'Chemical ID is required',
        'number.base': 'Chemical ID must be a number'
    }),
    quantity: joi_1.default.number().positive().precision(2).required()
        .messages({
        'any.required': 'Chemical quantity is required',
        'number.positive': 'Quantity must be greater than 0'
    }),
    batch_number: joi_1.default.string().max(50).optional().allow(null, '')
});
exports.updateFumigationSchema = joi_1.default.object({
    areas: joi_1.default.array().items(fumigationAreaSchema).min(1).required()
        .messages({
        'any.required': 'At least one fumigation area is required',
        'array.min': 'At least one fumigation area is required'
    }),
    target_pests: joi_1.default.array().items(fumigationPestSchema).min(1).required()
        .messages({
        'any.required': 'At least one target pest is required',
        'array.min': 'At least one target pest is required'
    }),
    chemicals: joi_1.default.array().items(fumigationChemicalSchema).min(1).required()
        .messages({
        'any.required': 'At least one chemical is required',
        'array.min': 'At least one chemical is required'
    })
});
exports.addInsectMonitorSchema = joi_1.default.object({
    monitor_type: joi_1.default.string().valid('box', 'fly_trap').required()
        .messages({
        'any.required': 'Monitor type is required',
        'any.only': 'Monitor type must be either box or fly_trap'
    }),
    monitor_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'other').required()
        .messages({
        'any.required': 'Monitor condition is required',
        'any.only': 'Monitor condition must be one of: good, replaced, repaired, other'
    }),
    monitor_condition_other: joi_1.default.string().max(255).optional().allow(null, '')
        .when('monitor_condition', {
        is: 'other',
        then: joi_1.default.required().messages({
            'any.required': 'Description is required when monitor condition is other'
        })
    }),
    warning_sign_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'remounted').required()
        .messages({
        'any.required': 'Warning sign condition is required',
        'any.only': 'Warning sign condition must be one of: good, replaced, repaired, remounted'
    }),
    light_condition: joi_1.default.string().valid('good', 'faulty', 'na').optional().default('na')
        .when('monitor_type', {
        is: 'fly_trap',
        then: joi_1.default.valid('good', 'faulty').required().messages({
            'any.required': 'Light condition is required for fly trap monitors'
        })
    }),
    light_faulty_type: joi_1.default.string().valid('starter', 'tube', 'cable', 'electricity', 'other', 'na').optional().default('na')
        .when('light_condition', {
        is: 'faulty',
        then: joi_1.default.valid('starter', 'tube', 'cable', 'electricity', 'other').required().messages({
            'any.required': 'Light faulty type is required when light is faulty'
        })
    }),
    light_faulty_other: joi_1.default.string().max(255).optional().allow(null, '')
        .when('light_faulty_type', {
        is: 'other',
        then: joi_1.default.required().messages({
            'any.required': 'Description is required when light faulty type is other'
        })
    }),
    glue_board_replaced: joi_1.default.boolean().required()
        .messages({
        'any.required': 'Glue board replacement status is required'
    }),
    tubes_replaced: joi_1.default.boolean().optional().allow(null)
        .when('monitor_type', {
        is: 'fly_trap',
        then: joi_1.default.required().messages({
            'any.required': 'Tubes replacement status is required for fly traps'
        })
    }),
    monitor_serviced: joi_1.default.boolean().required()
        .messages({
        'any.required': 'Monitor serviced status is required'
    })
});
exports.updateInsectMonitorSchema = joi_1.default.object({
    monitor_type: joi_1.default.string().valid('box', 'fly_trap').optional(),
    monitor_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'other').optional(),
    monitor_condition_other: joi_1.default.string().max(255).optional().allow(null, ''),
    warning_sign_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'remounted').optional(),
    light_condition: joi_1.default.string().valid('good', 'faulty', 'na').optional(),
    light_faulty_type: joi_1.default.string().valid('starter', 'tube', 'cable', 'electricity', 'other', 'na').optional(),
    light_faulty_other: joi_1.default.string().max(255).optional().allow(null, ''),
    glue_board_replaced: joi_1.default.boolean().optional(),
    tubes_replaced: joi_1.default.boolean().optional().allow(null),
    monitor_serviced: joi_1.default.boolean().optional()
});
//# sourceMappingURL=reportValidation.js.map