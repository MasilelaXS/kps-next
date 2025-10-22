'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Building2, FileText, CheckCircle, TrendingUp, Clock, Hand } from 'lucide-react';
import { API_CONFIG } from '@/lib/api';

interface DashboardStats {
  totalClients: number;
  activePCOs: number;
  pendingReports: number;
  completedReports: number;
}

interface MetricsResponse {
  users: {
    total: number;
    pco: { active: number; inactive: number; total: number };
    admin: { active: number; inactive: number; total: number };
  };
  clients: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
  };
  reports: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    declined: number;
  };
  assignments: {
    active: number;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('kps_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/dashboard/metrics`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      if (data.success) {
        const metrics: MetricsResponse = data.data;
        // Map backend data to frontend stats
        setStats({
          totalClients: metrics.clients.total,
          activePCOs: metrics.users.pco.active,
          pendingReports: metrics.reports.pending,
          completedReports: metrics.reports.approved
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout >
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          Welcome back!
        </h2>
        <p className="text-gray-600 mt-1">Here's what's happening with your business today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Clients */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              12%
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats?.totalClients || 0}</h3>
          <p className="text-gray-600 text-sm">Total Clients</p>
        </div>

        {/* Active PCOs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-blue-600">Active</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats?.activePCOs || 0}</h3>
          <p className="text-gray-600 text-sm">Active PCO Users</p>
        </div>

        {/* Pending Reports */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-orange-600">Review</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats?.pendingReports || 0}</h3>
          <p className="text-gray-600 text-sm">Pending Reports</p>
        </div>

        {/* Completed Reports */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-600">This month</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats?.completedReports || 0}</h3>
          <p className="text-gray-600 text-sm">Completed Reports</p>
        </div>
      </div>

      {/* Recent Activity & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No recent activity</p>
            </div>
          </div>
        </div>

        {/* Upcoming Assignments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Upcoming Assignments
          </h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No upcoming assignments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 transition-all text-center">
            <Building2 className="w-6 h-6 mx-auto mb-2" />
            <div className="text-sm font-medium">New Client</div>
          </button>
          <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 transition-all text-center">
            <Users className="w-6 h-6 mx-auto mb-2" />
            <div className="text-sm font-medium">Add PCO</div>
          </button>
          <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 transition-all text-center">
            <FileText className="w-6 h-6 mx-auto mb-2" />
            <div className="text-sm font-medium">Assignments</div>
          </button>
          <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 transition-all text-center">
            <FileText className="w-6 h-6 mx-auto mb-2" />
            <div className="text-sm font-medium">View Reports</div>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
