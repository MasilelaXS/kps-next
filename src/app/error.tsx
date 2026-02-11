'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="/icons/192.png" 
            alt="KPS Logo" 
            className="w-20 h-20"
          />
        </div>

        {/* Error Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6">
            <div className="flex justify-center mb-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
                <AlertTriangle className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-white/90 text-center text-sm">
              Don't worry, this happens sometimes
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-700 text-center mb-6">
              We encountered an unexpected error while processing your request. Please try again or return to the home page.
            </p>

            {/* Error details (only in development) */}
            {process.env.NODE_ENV === 'development' && error.message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-xs font-semibold text-red-800 mb-2">Development Info:</p>
                <p className="text-xs font-mono text-red-600 break-all leading-relaxed">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-gray-500 mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                <Home className="w-5 h-5" />
                Go to Home
              </button>
            </div>

            {/* Help text */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-center text-gray-500">
                If this problem persists, please contact your system administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">KPS Pest Control</span> • Powered by Dannel Web Design
          </p>
        </div>
      </div>
    </div>
  );
}
