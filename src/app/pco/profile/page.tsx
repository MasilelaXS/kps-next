'use client';

import { useEffect, useState } from 'react';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import { User, Mail, Phone, MapPin, Calendar, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PCOProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('kps_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kps_token');
    localStorage.removeItem('kps_user');
    router.push('/login');
  };

  if (!user) {
    return (
      <PcoDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </PcoDashboardLayout>
    );
  }

  return (
    <PcoDashboardLayout>
      <div className="space-y-6">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white font-bold text-3xl mb-4">
              {user.name?.charAt(0) || 'U'}
            </div>
            <h1 className="text-2xl font-bold mb-1">{user.name}</h1>
            <p className="text-blue-100">PCO User</p>
          </div>
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {/* Name */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Full Name</p>
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
              </div>
            </div>

            {/* Email */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Email Address</p>
                <p className="text-sm font-medium text-gray-900">{user.email || 'Not provided'}</p>
              </div>
            </div>

            {/* Phone */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Phone Number</p>
                <p className="text-sm font-medium text-gray-900">{user.phone || 'Not provided'}</p>
              </div>
            </div>

            {/* Login ID */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Login ID</p>
                <p className="text-sm font-medium text-gray-900">{user.login_id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        {/* App Info */}
        <div className="text-center text-sm text-gray-500 pt-4">
          <p>KPS PCO Portal</p>
          <p className="text-xs">Version 1.0.0</p>
        </div>
      </div>
    </PcoDashboardLayout>
  );
}
