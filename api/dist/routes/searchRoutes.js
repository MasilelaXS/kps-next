"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const searchController_1 = require("../controllers/searchController");
const router = (0, express_1.Router)();
router.get('/global', auth_1.authenticateToken, searchController_1.globalSearch);
router.get('/reports', auth_1.authenticateToken, searchController_1.searchReports);
router.get('/users', auth_1.authenticateToken, searchController_1.searchUsers);
router.get('/clients', auth_1.authenticateToken, searchController_1.searchClients);
router.get('/chemicals', auth_1.authenticateToken, searchController_1.searchChemicals);
exports.default = router;
//# sourceMappingURL=searchRoutes.js.map