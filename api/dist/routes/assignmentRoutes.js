"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assignmentController_1 = require("../controllers/assignmentController");
const auth_1 = require("../middleware/auth");
const assignmentValidation_1 = require("../middleware/assignmentValidation");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, async (req, res, next) => {
    if (req.user?.role === 'pco') {
        return assignmentController_1.AssignmentController.getPCOAssignments(req, res);
    }
    next();
}, assignmentValidation_1.validateAssignmentListParams, assignmentController_1.AssignmentController.getAssignmentList);
router.get('/stats', auth_1.authenticateToken, assignmentController_1.AssignmentController.getAssignmentStats);
router.get('/workload-balance', auth_1.authenticateToken, assignmentController_1.AssignmentController.getWorkloadBalance);
router.post('/bulk-assign', auth_1.authenticateToken, assignmentValidation_1.validateBulkAssign, assignmentController_1.AssignmentController.bulkAssignClients);
router.post('/bulk-unassign', auth_1.authenticateToken, assignmentValidation_1.validateBulkUnassign, assignmentController_1.AssignmentController.bulkUnassignClients);
exports.default = router;
//# sourceMappingURL=assignmentRoutes.js.map