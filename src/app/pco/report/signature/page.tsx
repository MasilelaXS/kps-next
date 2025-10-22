'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReportLayout from '@/components/ReportLayout';
import TextBox from '@/components/TextBox';
import AlertModal from '@/components/AlertModal';
import { useAlert } from '@/hooks/useAlert';
import { PenTool, Trash2, AlertCircle, User } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import SignatureCanvas to avoid SSR issues
// Note: TypeScript shows ref error but component works correctly at runtime
const SignatureCanvas = dynamic(() => import('react-signature-canvas'), {
  ssr: false,
  loading: () => <div className="w-full h-64 bg-gray-100 rounded-xl animate-pulse" />
}) as any; // Cast to any to bypass TypeScript ref limitation with dynamic imports

export default function ClientSignature() {
  const router = useRouter();
  const alert = useAlert();
  const signatureRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = () => {
    try {
      const savedReport = localStorage.getItem('current_report');
      if (!savedReport) {
        setError('No report data found. Please start from the beginning.');
        setLoading(false);
        return;
      }

      const reportData = JSON.parse(savedReport);
      
      // Validate that previous steps are complete
      if (!reportData.nextServiceDate) {
        setError('Please complete the summary and set next service date first.');
        setLoading(false);
        return;
      }

      setReport(reportData);
      
      // Pre-fill client name from contact if available
      if (reportData.client?.contacts?.[0]?.name) {
        setClientName(reportData.client.contacts[0].name);
      }

      // Load existing signature if available
      if (reportData.clientSignature) {
        setHasSignature(true);
        // Will load signature after canvas is mounted
        setTimeout(() => {
          if (signatureRef.current) {
            signatureRef.current.fromDataURL(reportData.clientSignature);
          }
        }, 100);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading report:', error);
      setError('Failed to load report data');
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setHasSignature(false);
    }
  };

  const handleSignatureEnd = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const handleContinue = () => {
    if (!clientName.trim()) {
      alert.showWarning('Please enter the client name', 'Missing Information');
      return;
    }

    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      alert.showWarning('Please capture the client signature', 'Missing Signature');
      return;
    }

    // Save client signature and name
    const signatureDataURL = signatureRef.current.toDataURL('image/png');
    
    const updatedReport = {
      ...report,
      clientSignature: signatureDataURL,
      clientName: clientName.trim(),
      step: 'review',
      lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('current_report', JSON.stringify(updatedReport));
    
    // Navigate to final review/submit
    router.push('/pco/report/submit');
  };

  if (loading) {
    return (
      <ReportLayout currentStep={4} totalSteps={5} title="Client Signature">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ReportLayout>
    );
  }

  if (error) {
    return (
      <ReportLayout currentStep={4} totalSteps={5} title="Client Signature">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => router.push('/pco/report/summary')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Back to Summary
              </button>
            </div>
          </div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout currentStep={4} totalSteps={5} title="Client Signature">
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-900">
            <strong>Please ask the client to sign below</strong> to confirm the service has been completed.
          </p>
        </div>

        {/* Client Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Company Name</p>
              <p className="font-medium text-gray-900">{report?.client?.company_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Service Date</p>
              <p className="font-medium text-gray-900">
                {new Date(report?.serviceDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Report Type</p>
              <p className="font-medium text-gray-900 capitalize">
                {report?.reportType === 'both' ? 'Bait Inspection + Fumigation' : report?.reportType}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Next Service Date</p>
              <p className="font-medium text-gray-900">
                {new Date(report?.nextServiceDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Client Name Input */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <TextBox
            type="text"
            label="Client Name"
            icon={<User className="w-4 h-4 text-gray-500" />}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Enter client's full name"
            required
          />
        </div>

        {/* Signature Canvas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-gray-500" />
              Client Signature
            </label>
            <button
              onClick={handleClearSignature}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
            <SignatureCanvas
              ref={signatureRef}
              onEnd={handleSignatureEnd}
              canvasProps={{
                className: 'w-full h-64 cursor-crosshair',
                style: { touchAction: 'none' }
              }}
              backgroundColor="rgb(255, 255, 255)"
              penColor="rgb(0, 0, 0)"
            />
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            Sign using your finger or stylus
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/pco/report/summary')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!clientName.trim() || !hasSignature}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
      
      <AlertModal
        isOpen={alert.isOpen}
        {...alert.config}
        onClose={alert.hideAlert}
      />
    </ReportLayout>
  );
}
