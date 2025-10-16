"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const pcoSyncController_1 = require("../controllers/pcoSyncController");
const syncValidation_1 = require("../validation/syncValidation");
const router = (0, express_1.Router)();
router.get('/pco/sync/full', auth_1.authenticateToken, pcoSyncController_1.getFullSync);
router.get('/pco/sync/clients', auth_1.authenticateToken, (0, validation_1.validateRequest)(syncValidation_1.syncQuerySchema, 'query'), pcoSyncController_1.syncClients);
router.get('/pco/sync/chemicals', auth_1.authenticateToken, (0, validation_1.validateRequest)(syncValidation_1.syncQuerySchema, 'query'), pcoSyncController_1.syncChemicals);
router.get('/pco/sync/reports', auth_1.authenticateToken, (0, validation_1.validateRequest)(syncValidation_1.syncQuerySchema, 'query'), pcoSyncController_1.syncRecentReports);
router.post('/pco/sync/upload', auth_1.authenticateToken, (0, validation_1.validateRequest)(syncValidation_1.uploadReportsSchema), pcoSyncController_1.uploadReports);
router.get('/pco/data/export', auth_1.authenticateToken, pcoSyncController_1.exportData);
exports.default = router;
//# sourceMappingURL=pcoSyncRoutes.js.map