'use client';

import { AlertCircle, Download, X } from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  message: string;
  onDismiss: () => void;
  onUpdate: () => void;
}

export default function UpdateModal({
  isOpen,
  forceUpdate,
  currentVersion,
  latestVersion,
  message,
  onDismiss,
  onUpdate
}: UpdateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className={`p-6 ${forceUpdate ? 'bg-red-50' : 'bg-blue-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                forceUpdate ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                {forceUpdate ? (
                  <AlertCircle className={`w-6 h-6 ${forceUpdate ? 'text-red-600' : 'text-blue-600'}`} />
                ) : (
                  <Download className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {forceUpdate ? 'Update Required' : 'Update Available'}
                </h3>
                <p className="text-sm text-gray-600">
                  Version {latestVersion}
                </p>
              </div>
            </div>
            {!forceUpdate && (
              <button
                onClick={onDismiss}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">{message}</p>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current Version:</span>
                <span className="font-semibold text-gray-900">{currentVersion}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Latest Version:</span>
                <span className="font-semibold text-blue-600">{latestVersion}</span>
              </div>
            </div>
          </div>

          {forceUpdate && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <span className="font-semibold">⚠️ Critical Update:</span> This update is required to continue using the app. Please update now.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!forceUpdate && (
              <button
                onClick={onDismiss}
                className="flex-1 px-4 py-3 text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Later
              </button>
            )}
            <button
              onClick={onUpdate}
              className={`${
                forceUpdate ? 'flex-1' : 'flex-1'
              } px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2`}
            >
              <Download className="w-5 h-5" />
              Update Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
