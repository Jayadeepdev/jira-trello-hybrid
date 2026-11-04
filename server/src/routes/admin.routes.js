import express from 'express';
import {
  getPendingAdminRequests,
  processAdminRequest,
  requestAdminRole,
  getAuditLogs,
} from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.js'; // Fixed path to match auth.js

const router = express.Router();

// Apply auth middleware to all admin/audit routes
router.use(protect);

router.get('/pending-admins', getPendingAdminRequests);
router.post('/process-admin', processAdminRequest);
router.post('/request-admin', requestAdminRole);
router.get('/audit-logs', getAuditLogs);

export default router;