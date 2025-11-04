'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Building2, 
  FileText, 
  Calendar, 
  User,
  LogOut
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import Loading from './Loading';
import OfflineSyncStatus from './OfflineSyncStatus';
import { requireAuth, logout } from '@/lib/auth';
import { preloadCache } from '@/lib/preloadCache';

interface PcoDashboardLayoutProps {
  children: React.ReactNode;
}

export default function PcoDashboardLayout({ children }: PcoDashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check authentication and token expiry
    const isAuth = requireAuth('pco');
    if (!isAuth) {
      // Force redirect immediately, don't wait for requireAuth
      router.replace('/login');
      return;
    }

    const userData = localStorage.getItem('kps_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      // Check role_context for access (handles dual-role users correctly)
      const roleContext = parsedUser.role_context || parsedUser.role;
      
      if (roleContext !== 'pco') {
        console.log(`Access denied: User context is ${roleContext}, redirecting to correct portal`);
        if (roleContext === 'admin') {
          router.push('/admin/dashboard');
        } else {
          logout();
        }
      }

      // Preload critical data for offline access
      setTimeout(() => {
        preloadCache.preloadForRole('pco');
      }, 1000);
    }
  }, [router]);

  const handleLogout = () => {
    logout();
  };

  const pcoNav = [
    { name: 'Dashboard', href: '/pco/dashboard', icon: LayoutDashboard },
    { name: 'Schedule', href: '/pco/schedule', icon: Calendar },
    { name: 'Reports', href: '/pco/reports', icon: FileText },
    { name: 'Profile', href: '/pco/profile', icon: User },
  ];

  // Prevent hydration mismatch and ensure user has PCO context
  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="lg" />
      </div>
    );
  }

  const roleContext = user.role_context || user.role;
  if (roleContext !== 'pco') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Mobile Header - Fixed at top */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg"></div>
          <h1 className="text-lg font-semibold text-gray-900">PCO Portal</h1>
        </div>
        <div className="flex items-center gap-2">
          <OfflineSyncStatus />
          <NotificationBell />
        </div>
      </header>

      {/* Main Content with padding for header and bottom nav */}
      <main className="pt-14 pb-20 px-4">
        {children}
      </main>

      {/* Bottom Navigation - Fixed at bottom */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-30">
        <div className="h-full flex items-center justify-around px-2">
          {pcoNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all active:scale-95 ${
                  isActive
                    ? 'text-purple-600'
                    : 'text-gray-500'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
