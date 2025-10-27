'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReportLayout from '@/components/ReportLayout';
import TextBox from '@/components/TextBox';
import Loading from '@/components/Loading';
import AlertModal from '@/components/AlertModal';
import { useAlert } from '@/hooks/useAlert';
import { API_CONFIG, apiCall } from '@/lib/api';
import { FileText, Beaker, Calendar, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import SignatureCanvas to avoid SSR issues
// Cast to any to bypass TypeScript ref limitation with dynamic imports
const SignatureCanvas = dynamic(() => import('react-signature-canvas'), {
  ssr: false,
  loading: () => <div className="w-full h-48 bg-gray-100 rounded-xl animate-pulse" />
}) as any;

// Separate component to use useSearchParams
function NewReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alert = useAlert();
  const clientId = searchParams.get('clientId');
  const reportId = searchParams.get('reportId'); // Edit mode detection
  const signatureRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);
  const [existingReport, setExistingReport] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Report state
  const [reportType, setReportType] = useState<'bait' | 'fumigation' | 'both'>('bait');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [nextServiceDate, setNextServiceDate] = useState<string>('');
  const [pcoSignature, setPcoSignature] = useState<string | null>(null);
  const [generalRemarks, setGeneralRemarks] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');

  useEffect(() => {
    if (reportId) {
      // Edit/Resubmit mode
      setIsEditMode(true);
      fetchExistingReport();
    } else if (clientId) {
      // Create mode
      fetchClientData();
    } else {
      setError('No client or report selected');
      setLoading(false);
    }
  }, [clientId, reportId]);

  const fetchExistingReport = async () => {
    try {
      setLoading(true);
      
      // Fetch the existing report with all details
      const response = await apiCall(`/api/pco/reports/${reportId}`);
      
      if (response.success && response.data) {
        const report = response.data;
        setExistingReport(report);
        
        // Pre-populate form fields
        setReportType(report.report_type);
        setServiceDate(report.service_date.split('T')[0]);
        setNextServiceDate(report.next_service_date ? report.next_service_date.split('T')[0] : '');
        setGeneralRemarks(report.general_remarks || '');
        setAdminNotes(report.admin_notes || '');
        
        // Set signatures if they exist
        if (report.pco_signature_data) {
          setPcoSignature(report.pco_signature_data);
        }
        
        // Fetch client data - try sync first, then fallback to direct API
        let foundClient = null;
        const clientResponse = await apiCall(`/api/pco/sync/clients?include_contacts=true`);
        
        if (clientResponse.success && Array.isArray(clientResponse.data)) {
          foundClient = clientResponse.data.find((c: any) => c.id === report.client_id);
        }
        
        // If client not found in sync (not assigned), use client data from report
        if (!foundClient && report.company_name) {
          // Use equipment counts from the report response (from client table in DB)
          const clientAddress = [
            report.address_line1,
            report.address_line2,
            report.city,
            report.state,
            report.postal_code
          ].filter(Boolean).join(', ');
          
          setClient({
            id: report.client_id,
            company_name: report.company_name,
            address: clientAddress || 'N/A',
            is_active: true, // Assume active for edit mode
            contacts: [],
            total_bait_stations_inside: report.total_bait_stations_inside || 0,
            total_bait_stations_outside: report.total_bait_stations_outside || 0,
            total_insect_monitors_light: report.total_insect_monitors_light || 0,
            total_insect_monitors_box: report.total_insect_monitors_box || 0
          });
        } else if (foundClient) {
          setClient({
            id: foundClient.id,
            company_name: foundClient.company_name,
            address: [
              foundClient.address_line1,
              foundClient.address_line2,
              foundClient.city,
              foundClient.state,
              foundClient.postal_code
            ].filter(Boolean).join(', '),
            is_active: foundClient.status === 'active',
            contacts: foundClient.contacts ? JSON.parse(foundClient.contacts) : [],
            total_bait_stations_inside: foundClient.total_bait_stations_inside || 0,
            total_bait_stations_outside: foundClient.total_bait_stations_outside || 0,
            total_insect_monitors_light: foundClient.total_insect_monitors_light || 0,
            total_insect_monitors_box: foundClient.total_insect_monitors_box || 0
          });
        } else {
          setError('Client information not available for this report');
        }
        
        // Note: Bait stations, fumigation areas, and monitors will be pre-populated
        // in their respective step pages from localStorage
        
      } else {
        setError('Failed to load report data');
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      setError('Failed to load report information');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientData = async () => {
    try {
      setLoading(true);
      
      // Fetch assigned clients from sync endpoint
      const response = await apiCall('/api/pco/sync/clients?include_contacts=true');
      
      if (response.success && Array.isArray(response.data)) {
        // Find the specific client by ID
        const foundClient = response.data.find((c: any) => c.id === parseInt(clientId!));
        
        if (foundClient) {
          setClient({
            id: foundClient.id,
            company_name: foundClient.company_name,
            address: [
              foundClient.address_line1,
              foundClient.address_line2,
              foundClient.city,
              foundClient.state,
              foundClient.postal_code
            ].filter(Boolean).join(', '),
            is_active: foundClient.status === 'active',
            contacts: foundClient.contacts ? JSON.parse(foundClient.contacts) : [],
            total_bait_stations_inside: foundClient.total_bait_stations_inside || 0,
            total_bait_stations_outside: foundClient.total_bait_stations_outside || 0,
            total_insect_monitors_light: foundClient.total_insect_monitors_light || 0,
            total_insect_monitors_box: foundClient.total_insect_monitors_box || 0
          });
          
          // Check if client is active
          if (foundClient.status !== 'active') {
            setError('This client is currently inactive. Cannot create report.');
          }
        } else {
          setError('Client not found or not assigned to you');
        }
      } else {
        setError('Failed to load client data');
      }
    } catch (error) {
      console.error('Error fetching client:', error);
      setError('Failed to load client information');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setPcoSignature(null);
    }
  };

  const handleSaveSignature = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const signature = signatureRef.current.toDataURL();
      setPcoSignature(signature);
    }
  };

  const handleContinue = () => {
    // Validate
    if (!pcoSignature) {
      alert.showWarning('Please provide your signature', 'Missing Signature');
      return;
    }

    if (serviceDate > new Date().toISOString().split('T')[0]) {
      alert.showWarning('Service date cannot be in the future', 'Invalid Date');
      return;
    }

    // Store report data in localStorage (including existing report data for edit mode)
    const reportData = {
      reportId: isEditMode ? reportId : undefined, // Include reportId if editing
      clientId,
      client: client,
      reportType,
      serviceDate,
      nextServiceDate,
      generalRemarks,
      pcoSignature,
      step: 'bait-inspection', // or 'fumigation' based on type
      createdAt: new Date().toISOString(),
      isEditMode,
      // Include existing report data for pre-population in subsequent steps
      existingData: isEditMode && existingReport ? {
        baitStations: existingReport.bait_stations || [],
        fumigationAreas: existingReport.fumigation?.areas || [],
        fumigationPests: existingReport.fumigation?.target_pests || [],
        fumigationChemicals: existingReport.fumigation?.chemicals || [],
        insectMonitors: existingReport.insect_monitors || [],
        clientSignature: existingReport.client_signature_data || null,
        clientName: existingReport.client_signature_name || ''
      } : undefined
    };

    localStorage.setItem('current_report', JSON.stringify(reportData));

    // Navigate to next screen based on report type
    if (reportType === 'bait' || reportType === 'both') {
      router.push(`/pco/report/bait-inspection?clientId=${clientId}${isEditMode ? `&reportId=${reportId}` : ''}`);
    } else {
      router.push(`/pco/report/fumigation?clientId=${clientId}${isEditMode ? `&reportId=${reportId}` : ''}`);
    }
  };

  const handleSaveDraft = () => {
    // Save as draft
    const draftData = {
      clientId,
      client,
      reportType,
      serviceDate,
      pcoSignature,
      status: 'draft',
      lastSaved: new Date().toISOString()
    };

    // Store in localStorage (later will be synced to backend)
    const drafts = JSON.parse(localStorage.getItem('report_drafts') || '[]');
    drafts.push(draftData);
    localStorage.setItem('report_drafts', JSON.stringify(drafts));

    alert.showSuccess('Draft saved successfully!');
    router.push('/pco/schedule');
  };

  if (loading) {
    return (
      <ReportLayout title={isEditMode ? "Edit & Resubmit Report" : "New Report"} showCancelWarning={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loading size="lg" text="Loading..." />
        </div>
      </ReportLayout>
    );
  }

  if (error || !client) {
    return (
      <ReportLayout title={isEditMode ? "Edit & Resubmit Report" : "New Report"} showCancelWarning={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cannot Create Report</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/pco/schedule')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
            >
              Back to Schedule
            </button>
          </div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout title={isEditMode ? "Edit & Resubmit Report" : "New Report"} showCancelWarning={true}>
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        {/* Admin Feedback Alert for Declined Reports */}
        {isEditMode && adminNotes && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Admin Feedback</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{adminNotes}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Client Info */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
          <h2 className="text-lg font-bold mb-1">Service Report</h2>
          <p className="text-blue-100">{client.company_name}</p>
        </div>

        {/* Report Type Selection */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Type</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => setReportType('bait')}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                reportType === 'bait'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                reportType === 'bait' ? 'border-blue-600' : 'border-gray-300'
              }`}>
                {reportType === 'bait' && (
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Bait Inspection</div>
                <div className="text-sm text-gray-600">Inspect and maintain bait stations</div>
              </div>
            </button>

            <button
              onClick={() => setReportType('fumigation')}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                reportType === 'fumigation'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                reportType === 'fumigation' ? 'border-blue-600' : 'border-gray-300'
              }`}>
                {reportType === 'fumigation' && (
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Fumigation</div>
                <div className="text-sm text-gray-600">Chemical treatment and monitoring</div>
              </div>
            </button>

            <button
              onClick={() => setReportType('both')}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                reportType === 'both'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                reportType === 'both' ? 'border-blue-600' : 'border-gray-300'
              }`}>
                {reportType === 'both' && (
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Both</div>
                <div className="text-sm text-gray-600">Bait inspection + Fumigation</div>
              </div>
            </button>
          </div>
        </div>

        {/* Service Date */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <TextBox
            type="date"
            label="Service Date"
            icon={<Calendar className="w-5 h-5 text-gray-400" />}
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            helperText="Service date cannot be in the future"
          />
        </div>

        {/* PCO Signature */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <label className="block text-lg font-semibold text-gray-900 mb-4">
            PCO Signature
          </label>
          
          <div className="border-2 border-gray-300 rounded-xl bg-gray-50 mb-3">
            <SignatureCanvas
              ref={signatureRef}
              canvasProps={{
                className: 'w-full h-48 rounded-xl',
              }}
              onEnd={handleSaveSignature}
            />
          </div>
          
          <button
            onClick={handleClearSignature}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Clear Signature
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {!isEditMode && (
            <button
              onClick={handleSaveDraft}
              className="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-colors active:scale-95"
            >
              Save Draft
            </button>
          )}
          <button
            onClick={handleContinue}
            className={`${!isEditMode ? 'flex-1' : 'w-full'} px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors active:scale-95`}
          >
            {isEditMode ? 'Continue to Edit Report' : 'Continue'}
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

// Main component with Suspense wrapper
export default function NewReportPage() {
  return (
    <Suspense fallback={
      <ReportLayout title="New Report" showCancelWarning={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loading size="lg" />
        </div>
      </ReportLayout>
    }>
      <NewReportContent />
    </Suspense>
  );
}
