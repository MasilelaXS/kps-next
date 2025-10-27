/**
 * KPS Pest Control Management System - Main Routes
 * 
 * Central routing configuration for the API
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Router } from 'express';
import authRoutes from './auth';
import versionRoutes from './versionRoutes';
import userRoutes from './userRoutes';
import clientRoutes from './clientRoutes';
import chemicalRoutes from './chemicalRoutes';
import assignmentRoutes from './assignmentRoutes';
import reportRoutes from './reportRoutes';
import pcoDashboardRoutes from './pcoDashboardRoutes';
import pcoSyncRoutes from './pcoSyncRoutes';
import adminDashboardRoutes from './adminDashboardRoutes';
import searchRoutes from './searchRoutes';
import notificationRoutes from './notificationRoutes';

const router = Router();

// API Version and Info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to KPS Pest Control Management API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: '/api/auth',
      version: '/api/version',
      users: '/api/admin/users',
      clients: '/api/admin/clients',
      chemicals: '/api/admin/chemicals',
      chemical_search: '/api/chemicals/search',
      assignments: '/api/admin/assignments',
      pco_reports: '/api/pco/reports',
      admin_reports: '/api/admin/reports',
      pco_dashboard: '/api/pco/dashboard',
      pco_sync: '/api/pco/sync',
      pco_data_export: '/api/pco/data/export',
      admin_dashboard: '/api/admin/dashboard',
      search: '/api/search',
      notifications: '/api/notifications',
      health: '/health',
      status: '/api/status'
    }
  });
});

// Authentication routes
router.use('/auth', authRoutes);

// Version management routes
router.use('/version', versionRoutes);

// User management routes (Admin only)
router.use('/admin/users', userRoutes);

// Client management routes (Admin only)
router.use('/admin/clients', clientRoutes);

// Chemical management routes
router.use('/', chemicalRoutes);

// Assignment management routes (Admin only)
router.use('/admin/assignments', assignmentRoutes);

// PCO assignments route (PCO can view their own)
router.use('/pco/assignments', assignmentRoutes);

// Report management routes (PCO and Admin)
router.use('/', reportRoutes);

// PCO Dashboard routes (Phase 4.1)
router.use('/pco/dashboard', pcoDashboardRoutes);

// PCO Sync & Offline Data routes (Phase 4.2)
router.use('/', pcoSyncRoutes);

// Admin Dashboard routes (Phase 5.1)
router.use('/', adminDashboardRoutes);

// Search routes (Phase 5.2)
router.use('/search', searchRoutes);

// Notification routes (Phase 5.2)
router.use('/notifications', notificationRoutes);

// Future route groups will be added here:
// router.use('/schedules', scheduleRoutes);

export default router;