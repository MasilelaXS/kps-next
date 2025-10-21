'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle } from 'lucide-react';

interface ReportLayoutProps {
  children: React.ReactNode;
  title?: string;
  showCancelWarning?: boolean;
  onCancel?: () => void;
  currentStep?: number;
  totalSteps?: number;
}

export default function ReportLayout({ 
  children, 
  title = 'New Report',
  showCancelWarning = true,
  onCancel,
  currentStep,
  totalSteps
}: ReportLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);

  useEffect(() => {
    setMounted(true);
    const userData = localStorage.getItem('kps_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleCancel = () => {
    if (showCancelWarning) {
      setShowExitWarning(true);
    } else {
      if (onCancel) {
        onCancel();
      } else {
        router.push('/pco/schedule');
      }
    }
  };

  const confirmCancel = () => {
    setShowExitWarning(false);
    if (onCancel) {
      onCancel();
    } else {
      router.push('/pco/schedule');
    }
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
          aria-label="Cancel"
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>
      </header>

      {/* Progress Indicator */}
      {currentStep && totalSteps && (
        <div className="fixed top-14 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-20">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((currentStep / totalSteps) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`px-4 pb-6 ${currentStep && totalSteps ? 'pt-[118px]' : 'pt-14'}`}>
        {children}
      </main>

      {/* Exit Warning Modal */}
      {showExitWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              Cancel Report?
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Your progress will be lost. Are you sure you want to cancel?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitWarning(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-xl transition-colors active:scale-95"
              >
                Continue Report
              </button>
              <button
                onClick={confirmCancel}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors active:scale-95"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
