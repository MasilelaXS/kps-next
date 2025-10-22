'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TextBox from '@/components/TextBox';
import { User, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [pcoNumber, setPcoNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://192.168.1.128:3001/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pco_number: pcoNumber })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      if (data.success) {
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Check Your Email
            </h2>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start">
              <Mail className="h-6 w-6 text-green-500 mt-1" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-green-900 mb-2">
                  Password Reset Email Sent
                </h3>
                <p className="text-sm text-green-700 mb-4">
                  We've sent a password reset link to the email address associated with PCO number <strong>{pcoNumber}</strong>.
                </p>
                <p className="text-sm text-green-700 mb-4">
                  Please check your email and click the reset link to create a new password. The link will expire in 1 hour.
                </p>
                <p className="text-xs text-green-600">
                  If you don't see the email, please check your spam folder.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => router.push('/login')}
              className="text-purple-600 hover:text-purple-500 font-medium text-sm"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your PCO number and we'll send you a password reset link
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
          <div>
            <TextBox
              id="pco_number"
              name="pco_number"
              type="text"
              required
              label="PCO Number"
              placeholder="Enter your PCO number (e.g., 12345)"
              value={pcoNumber}
              onChange={(e) => setPcoNumber(e.target.value)}
              icon={<User className="w-4 h-4 text-gray-400" />}
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter just the number without "admin" or "pco" prefix
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
