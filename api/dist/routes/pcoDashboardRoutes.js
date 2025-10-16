"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pcoDashboardController_1 = require("../controllers/pcoDashboardController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)('pco'));
router.get('/summary', pcoDashboardController_1.getDashboardSummary);
router.get('/upcoming-assignments', pcoDashboardController_1.getUpcomingAssignments);
router.get('/recent-reports', pcoDashboardController_1.getRecentReports);
router.get('/declined-reports', pcoDashboardController_1.getDeclinedReports);
router.get('/statistics', pcoDashboardController_1.getStatistics);
exports.default = router;
//# sourceMappingURL=pcoDashboardRoutes.js.map