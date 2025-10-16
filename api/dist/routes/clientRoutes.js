"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const clientController_1 = require("../controllers/clientController");
const auth_1 = require("../middleware/auth");
const clientValidation_1 = require("../middleware/clientValidation");
const router = express_1.default.Router();
router.get('/debug', auth_1.authenticateToken, clientController_1.ClientController.debugDatabase);
router.get('/', auth_1.authenticateToken, clientValidation_1.validateClientListParams, clientController_1.ClientController.getClientList);
router.post('/', auth_1.authenticateToken, clientValidation_1.validateClientInput, clientController_1.ClientController.createClient);
router.get('/search', auth_1.authenticateToken, clientValidation_1.validateClientSearch, clientController_1.ClientController.searchClients);
router.get('/:id', auth_1.authenticateToken, clientController_1.ClientController.getClientById);
router.put('/:id', auth_1.authenticateToken, clientValidation_1.validateClientUpdate, clientController_1.ClientController.updateClient);
router.delete('/:id', auth_1.authenticateToken, clientController_1.ClientController.deleteClient);
router.get('/:id/contacts', auth_1.authenticateToken, clientController_1.ClientController.getClientContacts);
router.post('/:id/contacts', auth_1.authenticateToken, clientValidation_1.validateContactInput, clientController_1.ClientController.addClientContact);
router.put('/:id/contacts/:contactId', auth_1.authenticateToken, clientValidation_1.validateContactUpdate, clientController_1.ClientController.updateClientContact);
router.delete('/:id/contacts/:contactId', auth_1.authenticateToken, clientController_1.ClientController.deleteClientContact);
router.get('/:id/reports', auth_1.authenticateToken, clientController_1.ClientController.getClientReports);
router.post('/:id/assign-pco', auth_1.authenticateToken, clientController_1.ClientController.assignPcoToClient);
router.post('/:id/unassign-pco', auth_1.authenticateToken, clientController_1.ClientController.unassignPcoFromClient);
router.get('/:id/assignments', auth_1.authenticateToken, clientController_1.ClientController.getClientPcoAssignments);
exports.default = router;
//# sourceMappingURL=clientRoutes.js.map