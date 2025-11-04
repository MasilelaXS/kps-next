'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  ClipboardList, 
  Beaker,
  Calendar,
  Menu,
  Bell,
  LogOut,
  User
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import Loading from './Loading';
import Button from './Button';
import { preloadCache } from '@/lib/preloadCache';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default to closed
  const [mounted, setMounted] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('...');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('kps_token');
    const userData = localStorage.getItem('kps_user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Check role_context for access (handles dual-role users correctly)
    const roleContext = parsedUser.role_context || parsedUser.role;
    
    if (roleContext !== 'admin') {
      console.log(`Access denied: User context is ${roleContext}, redirecting to correct portal`);
      if (roleContext === 'pco') {
        router.push('/pco/dashboard');
      } else {
        localStorage.removeItem('kps_token');
        localStorage.removeItem('kps_user');
        router.push('/login');
      }
    }

    // Preload critical data for offline access
    setTimeout(() => {
      preloadCache.preloadForRole('admin');
    }, 1000);

    // Fetch app version
    fetch('/api/version')
      .then((res) => res.json())
      .then((data) => setAppVersion(data.version || 'dev'))
      .catch(() => setAppVersion('dev'));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('kps_token');
    localStorage.removeItem('kps_user');
    router.push('/login');
  };

  const adminNav = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Clients', href: '/admin/clients', icon: Building2 },
    { name: 'Schedule', href: '/admin/schedule', icon: Calendar },
    { name: 'PCO Users', href: '/admin/users', icon: Users },
    { name: 'Reports', href: '/admin/reports', icon: FileText },
    { name: 'Chemicals', href: '/admin/chemicals', icon: Beaker },
  ];

  // Prevent hydration mismatch and ensure user has admin context
  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  const roleContext = user.role_context || user.role;
  if (roleContext !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg"></div>
                <span className="font-bold text-gray-900">KPS System</span>
              </div>
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg mx-auto"></div>
            )}
            {sidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                icon={<Menu className="w-5 h-5" />}
                className="!p-2"
              />
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <div key={item.href} className="relative group">
                  <Link 
                    href={item.href} 
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all active:scale-95 ${
                      isActive 
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md' 
                        : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                    } ${!sidebarOpen && 'justify-center'}`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="font-medium">{item.name}</span>}
                  </Link>
                  
                  {/* Tooltip for collapsed sidebar */}
                  {!sidebarOpen && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
                      {item.name}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Expand button when collapsed */}
          {!sidebarOpen && (
            <div className="p-4 border-t border-gray-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                icon={<Menu className="w-5 h-5" />}
                className="!p-2 w-full group relative"
                title="Expand Menu"
              >
                {/* Tooltip */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Expand Menu
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </Button>
            </div>
          )}

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              onClick={() => router.push('/admin/profile')}
              className={`!justify-start w-full !p-2 ${!sidebarOpen && '!justify-center'}`}
            >
              {sidebarOpen ? (
                <div className="flex items-center gap-3 w-full min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500">
                      {user.role === 'both' ? 'Administrator / PCO' : 'Administrator'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {user.name?.charAt(0) || 'U'}
                </div>
              )}
            </Button>
            {sidebarOpen ? (
              <Button
                variant="danger"
                size="md"
                onClick={handleLogout}
                icon={<LogOut className="w-4 h-4" />}
                fullWidth
                className="mt-3 !bg-red-50 !text-red-600 hover:!bg-red-100 !shadow-none"
              >
                Logout
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                icon={<LogOut className="w-5 h-5" />}
                className="!p-2 w-full mt-3 text-red-600 hover:!bg-red-50 group relative"
                title="Logout"
              >
                {/* Tooltip */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Logout
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </Button>
            )}

            {/* Version Display */}
            <div className={`mt-4 pt-4 border-t border-gray-200 ${sidebarOpen ? 'text-center' : 'flex justify-center'}`}>
              {sidebarOpen ? (
                <div className="text-xs text-gray-500">
                  <p className="font-medium">Powered By</p>
                  <p className="font-semibold text-gray-700">Dannel Web Design</p>
                  <p className="text-gray-400 mt-1">v{appVersion}</p>
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 font-medium">
                  v{appVersion}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Fixed Header */}
        <header className="fixed top-0 right-0 left-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30 transition-all duration-300" style={{ marginLeft: sidebarOpen ? '16rem' : '5rem' }}>
          <h1 className="text-lg font-semibold text-gray-900">
            Admin Portal
          </h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Page Content with top padding for fixed header */}
        <main className="p-4 mt-14">
          {children}
        </main>
      </div>
    </div>
  );
}
