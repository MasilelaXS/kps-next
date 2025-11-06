'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { buildApiUrl } from '@/lib/api';
import TextBox from '@/components/TextBox';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useDeviceStore } from '@/store/deviceStore';

export default function LoginPage() {
  const router = useRouter();
  const initializeDevice = useDeviceStore((state: any) => state.initializeDevice);
  const [formData, setFormData] = useState({
    login_id: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Initialize device detection on mount
  useEffect(() => {
    const cleanup = initializeDevice();
    return cleanup;
  }, [initializeDevice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.success && data.data) {
        // Store token, user info, and login timestamp
        localStorage.setItem('kps_token', data.data.token);
        localStorage.setItem('kps_user', JSON.stringify(data.data.user));
        localStorage.setItem('kps_login_time', new Date().toISOString());

        // Trigger push notification subscription
        window.dispatchEvent(new Event('kps-login'));

        // Redirect based on role_context (determined by login prefix: admin12345 or pco12345)
        // This allows users with role='both' to access either portal based on how they log in
        const roleContext = data.data.user.role_context || data.data.user.role;
        
        if (roleContext === 'admin') {
          router.push('/admin/dashboard');
        } else if (roleContext === 'pco') {
          router.push('/pco/dashboard');
        } else {
          router.push('/login');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            KPS Pest Control
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error}
                  </h3>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <TextBox
                id="login_id"
                name="login_id"
                type="text"
                autoComplete="username"
                required
                label="PCO Number"
                placeholder="PCO Number (e.g., admin12345 or pco67890)"
                value={formData.login_id}
                onChange={(e) => setFormData({ ...formData, login_id: e.target.value })}
                icon={<User className="w-4 h-4 text-gray-400" />}
              />
            </div>
            <div className="relative">
              <TextBox
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                label="Password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                icon={<Lock className="w-4 h-4 text-gray-400" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <a
                href="/forgot-password"
                className="font-medium text-purple-600 hover:text-purple-500"
              >
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Powered by <span className="font-semibold text-gray-700">Dannel Web Design</span></p>
        </div>
      </div>
    </div>
  );
}
