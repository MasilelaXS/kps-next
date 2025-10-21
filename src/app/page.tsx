'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('kps_token');
    const userStr = localStorage.getItem('kps_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        // Redirect to appropriate dashboard based on role
        if (user.role === 'admin') {
          router.replace('/admin/dashboard');
        } else if (user.role === 'pco') {
          router.replace('/pco/dashboard');
        } else {
          router.replace('/login');
        }
      } catch (err) {
        // Invalid user data, redirect to login
        router.replace('/login');
      }
    } else {
      // Not logged in, redirect to login page
      router.replace('/login');
    }
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-700 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg">Redirecting...</p>
      </div>
    </div>
  );
}
