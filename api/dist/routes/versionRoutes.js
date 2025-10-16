"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const versionController_1 = require("../controllers/versionController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
router.get('/current', versionController_1.VersionController.getCurrentVersion);
router.post('/admin/release', auth_1.authenticateToken, validation_1.validateVersionInput, versionController_1.VersionController.releaseVersion);
router.get('/admin/versions', auth_1.authenticateToken, versionController_1.VersionController.getVersionHistory);
router.put('/admin/versions/:id/status', auth_1.authenticateToken, versionController_1.VersionController.updateVersionStatus);
exports.default = router;
//# sourceMappingURL=versionRoutes.js.map