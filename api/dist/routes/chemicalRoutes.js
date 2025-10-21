"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chemicalController_1 = require("../controllers/chemicalController");
const auth_1 = require("../middleware/auth");
const chemicalValidation_1 = require("../middleware/chemicalValidation");
const router = (0, express_1.Router)();
router.get('/admin/chemicals', auth_1.authenticateToken, chemicalValidation_1.validateChemicalListParams, chemicalController_1.ChemicalController.getChemicalList);
router.post('/admin/chemicals', auth_1.authenticateToken, chemicalValidation_1.validateChemicalInput, chemicalController_1.ChemicalController.createChemical);
router.get('/admin/chemicals/:id', auth_1.authenticateToken, chemicalController_1.ChemicalController.getChemicalById);
router.put('/admin/chemicals/:id', auth_1.authenticateToken, chemicalValidation_1.validateChemicalUpdate, chemicalController_1.ChemicalController.updateChemical);
router.put('/admin/chemicals/:id/status', auth_1.authenticateToken, chemicalValidation_1.validateChemicalStatus, chemicalController_1.ChemicalController.updateChemicalStatus);
router.delete('/admin/chemicals/:id', auth_1.authenticateToken, chemicalController_1.ChemicalController.deleteChemical);
router.get('/chemicals/type/:usage_type', auth_1.authenticateToken, chemicalController_1.ChemicalController.getChemicalsByType);
router.get('/chemicals/search', auth_1.authenticateToken, chemicalValidation_1.validateChemicalSearch, chemicalController_1.ChemicalController.searchChemicals);
exports.default = router;
//# sourceMappingURL=chemicalRoutes.js.map