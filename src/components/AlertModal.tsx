'use client';

import { AlertCircle, CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  cancelText?: string;
  showCancel?: boolean;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  onConfirm,
  onCancel,
  cancelText = 'Cancel',
  showCancel = false
}: AlertModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const iconConfig = {
    success: { Icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    error: { Icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
    warning: { Icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    info: { Icon: Info, color: 'text-blue-600', bg: 'bg-blue-100' }
  };

  const { Icon, color, bg } = iconConfig[type];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className={`mx-auto flex items-center justify-center w-12 h-12 rounded-full ${bg} mb-4`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 text-center mb-6 whitespace-pre-line">
            {message}
          </p>

          {/* Actions */}
          <div className={`flex gap-3 ${showCancel ? 'justify-between' : 'justify-center'}`}>
            {showCancel && (
              <button
                onClick={() => {
                  if (onCancel) {
                    onCancel();
                  }
                  onClose();
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`${showCancel ? 'flex-1' : 'min-w-[120px]'} px-4 py-2.5 rounded-xl font-medium transition-colors ${
                type === 'error' 
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : type === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : type === 'warning'
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              autoFocus
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
