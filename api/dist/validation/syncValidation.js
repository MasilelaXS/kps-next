"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportQuerySchema = exports.uploadReportsSchema = exports.syncQuerySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.syncQuerySchema = joi_1.default.object({
    since: joi_1.default.date().iso().optional()
        .description('Timestamp to filter updates - only return items modified after this time'),
    client_id: joi_1.default.number().integer().positive().optional()
        .description('Filter by specific client ID'),
    include_contacts: joi_1.default.boolean().optional().default(true)
        .description('Include client contacts in response')
});
exports.uploadReportsSchema = joi_1.default.object({
    reports: joi_1.default.array().items(joi_1.default.object({
        local_id: joi_1.default.string().required()
            .description('Local database ID for mapping to server ID'),
        client_id: joi_1.default.number().integer().positive().required()
            .description('Client ID (must be actively assigned to PCO)'),
        report_type: joi_1.default.string().valid('bait_inspection', 'fumigation', 'both').required()
            .description('Type of pest control service'),
        service_date: joi_1.default.date().iso().max('now').required()
            .description('Date service was performed'),
        next_service_date: joi_1.default.date().iso().min(joi_1.default.ref('service_date')).optional().allow(null)
            .description('Recommended next service date'),
        pco_signature_data: joi_1.default.string().required()
            .description('Base64 encoded signature image'),
        client_signature_data: joi_1.default.string().required()
            .description('Base64 encoded client signature'),
        client_signature_name: joi_1.default.string().max(100).required()
            .description('Name of person who signed'),
        general_remarks: joi_1.default.string().max(1000).optional().allow(null)
            .description('General remarks about the service'),
        bait_stations: joi_1.default.array().items(joi_1.default.object({
            station_number: joi_1.default.string().max(50).required(),
            location: joi_1.default.string().valid('inside', 'outside').required(),
            is_accessible: joi_1.default.number().integer().valid(0, 1).default(1),
            inaccessible_reason: joi_1.default.string().max(255).optional().allow(null),
            activity_detected: joi_1.default.number().integer().valid(0, 1).default(0),
            activity_droppings: joi_1.default.number().integer().valid(0, 1).default(0),
            activity_gnawing: joi_1.default.number().integer().valid(0, 1).default(0),
            activity_tracks: joi_1.default.number().integer().valid(0, 1).default(0),
            activity_other: joi_1.default.number().integer().valid(0, 1).default(0),
            activity_other_description: joi_1.default.string().max(255).optional().allow(null),
            bait_status: joi_1.default.string().valid('clean', 'eaten', 'wet', 'old').default('clean'),
            station_condition: joi_1.default.string().valid('good', 'needs_repair', 'damaged', 'missing').default('good'),
            action_taken: joi_1.default.string().valid('repaired', 'replaced', 'none').default('none'),
            warning_sign_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'remounted').default('good'),
            rodent_box_replaced: joi_1.default.number().integer().valid(0, 1).default(0),
            station_remarks: joi_1.default.string().max(500).optional().allow(null),
            chemicals: joi_1.default.array().items(joi_1.default.object({
                chemical_id: joi_1.default.number().integer().positive().required(),
                quantity: joi_1.default.number().positive().required(),
                batch_number: joi_1.default.string().max(100).optional().allow(null)
            })).optional()
        })).optional(),
        fumigation: joi_1.default.object({
            areas: joi_1.default.array().items(joi_1.default.object({
                area_name: joi_1.default.string().max(100).required(),
                is_other: joi_1.default.number().integer().valid(0, 1).default(0),
                other_description: joi_1.default.string().max(255).optional().allow(null)
            })).optional(),
            target_pests: joi_1.default.array().items(joi_1.default.object({
                pest_name: joi_1.default.string().max(100).required(),
                is_other: joi_1.default.number().integer().valid(0, 1).default(0),
                other_description: joi_1.default.string().max(255).optional().allow(null)
            })).optional(),
            chemicals: joi_1.default.array().items(joi_1.default.object({
                chemical_id: joi_1.default.number().integer().positive().required(),
                quantity: joi_1.default.number().positive().required(),
                batch_number: joi_1.default.string().max(100).optional().allow(null)
            })).optional()
        }).optional(),
        insect_monitors: joi_1.default.array().items(joi_1.default.object({
            monitor_type: joi_1.default.string().valid('box', 'fly_trap').required(),
            monitor_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'other').default('good'),
            monitor_condition_other: joi_1.default.string().max(255).optional().allow(null),
            warning_sign_condition: joi_1.default.string().valid('good', 'replaced', 'repaired', 'remounted').default('good'),
            light_condition: joi_1.default.string().valid('good', 'faulty', 'na').default('na'),
            light_faulty_type: joi_1.default.string().valid('starter', 'tube', 'cable', 'electricity', 'other', 'na').default('na'),
            light_faulty_other: joi_1.default.string().max(255).optional().allow(null),
            glue_board_replaced: joi_1.default.number().integer().valid(0, 1).default(0),
            tubes_replaced: joi_1.default.number().integer().valid(0, 1).optional().allow(null),
            monitor_serviced: joi_1.default.number().integer().valid(0, 1).default(0)
        })).optional()
    })).min(1).max(50).required()
        .description('Array of reports to upload (max 50 per batch)')
});
exports.exportQuerySchema = joi_1.default.object({
    format: joi_1.default.string().valid('json').default('json')
        .description('Export format (only json supported currently)')
});
//# sourceMappingURL=syncValidation.js.map