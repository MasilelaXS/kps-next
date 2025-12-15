'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import Button from '@/components/Button';
import AlertModal from '@/components/AlertModal';

export default function ReportImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.kps')) {
      setError('Invalid file type. Please upload a .kps file exported from the system.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      // Read file content
      const fileContent = await file.text();
      
      // Parse JSON (the .kps file is actually JSON with renamed extension)
      let reportData;
      try {
        reportData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid file format. The file may be corrupted.');
      }

      // Validate report structure
      if (!reportData.client || !reportData.serviceDate || !reportData.reportType) {
        throw new Error('Invalid report data. Missing required fields.');
      }

      // Store in localStorage for the submit page to pick up
      localStorage.setItem('kps_imported_report', JSON.stringify(reportData));
      
      setSuccess(true);
      setShowSuccessModal(true);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import report');
    } finally {
      setUploading(false);
    }
  };

  const handleNavigateToSubmit = () => {
    router.push('/pco/report/submit');
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Upload className="w-6 h-6 text-purple-600" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Import Report
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload a previously exported report (.kps file) to continue editing or submit.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Import Failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {success && !showSuccessModal && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Report Imported Successfully</p>
                  <p className="text-sm text-green-700 mt-1">Navigate to Submit Report to review and submit.</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".kps"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                icon={<FileText className="w-4 h-4" />}
                variant="outline"
              >
                {uploading ? 'Importing...' : 'Choose File'}
              </Button>

              <p className="text-xs text-gray-500">
                Accepted format: .kps files only
              </p>
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={showSuccessModal}
        title="Report Imported Successfully"
        message="Your report has been imported. Would you like to navigate to the Submit Report page to review and submit it?"
        type="success"
        confirmText="Go to Submit Report"
        cancelText="Stay Here"
        onConfirm={handleNavigateToSubmit}
        onCancel={() => setShowSuccessModal(false)}
        onClose={() => setShowSuccessModal(false)}
      />
    </>
  );
}
