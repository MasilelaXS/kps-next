"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const userValidation_1 = require("../middleware/userValidation");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateToken, userValidation_1.validateUserListParams, userController_1.UserController.getUserList);
router.post('/', auth_1.authenticateToken, userValidation_1.validateUserInput, userController_1.UserController.createUser);
router.get('/search', auth_1.authenticateToken, userValidation_1.validateUserSearch, userController_1.UserController.searchUsers);
router.get('/:id', auth_1.authenticateToken, userController_1.UserController.getUserById);
router.put('/:id', auth_1.authenticateToken, userValidation_1.validateUserUpdate, userController_1.UserController.updateUser);
router.delete('/:id', auth_1.authenticateToken, userController_1.UserController.deleteUser);
router.put('/:id/status', auth_1.authenticateToken, userValidation_1.validateUserStatus, userController_1.UserController.updateUserStatus);
router.put('/:id/reset-password', auth_1.authenticateToken, userValidation_1.validatePasswordReset, userController_1.UserController.resetUserPassword);
router.get('/:id/assignments', auth_1.authenticateToken, userController_1.UserController.getUserAssignments);
router.post('/:id/unassign-all', auth_1.authenticateToken, userController_1.UserController.unassignAllClients);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map