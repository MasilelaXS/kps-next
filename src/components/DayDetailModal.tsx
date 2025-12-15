/**
 * Simple Day Detail Modal - Production Ready
 * Shows job details for selected calendar day
 */

import React, { useEffect } from 'react';
import { X, MapPin, Clock, User, Calendar } from 'lucide-react';

interface Report {
  id: number;
  client_name: string;
  report_type: string;
  status: string;
}

interface SimpleDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  reports: Report[];
  pcoName?: string;
}

const STATUS_COLORS: Record<string, string> = {
  'scheduled': 'bg-blue-100 text-blue-800',
  'in_progress': 'bg-yellow-100 text-yellow-800',
  'completed': 'bg-green-100 text-green-800',
  'pending': 'bg-gray-100 text-gray-800',
};

export function SimpleDayModal({ isOpen, onClose, date, reports, pcoName }: SimpleDayModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/25 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden transform transition-all flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Jobs for {formattedDate}
              </h2>
              {pcoName && (
                <p className="text-sm text-gray-600">{pcoName}</p>
              )}
            </div>
          </div>

          {/* Content - scrollable */}
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            {reports.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">No jobs scheduled for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">
                        {report.client_name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[report.status] || STATUS_COLORS.pending
                        }`}
                      >
                        {report.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <User className="h-4 w-4 mr-2" />
                      <span>{report.report_type}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Report ID: {report.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - always visible */}
          <div className="p-6 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimpleDayModal;