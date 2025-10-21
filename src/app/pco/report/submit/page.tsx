'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReportLayout from '@/components/ReportLayout';
import { apiCall } from '@/lib/api';
import { 
  CheckCircle, 
  AlertCircle,
  Download, 
  Send, 
  FileText,
  Calendar,
  User,
  MapPin,
  Beaker
} from 'lucide-react';

export default function SubmitReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [reportId, setReportId] = useState<number | null>(null);

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
      
      // Validate that all previous steps are complete
      if (!reportData.clientSignature || !reportData.clientName) {
        setError('Please complete the client signature first.');
        setLoading(false);
        return;
      }

      setReport(reportData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading report:', error);
      setError('Failed to load report data');
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const companyName = report?.client?.company_name || 'unknown-client';
    const serviceDate = report?.serviceDate || new Date().toISOString().split('T')[0];
    link.download = `report-${companyName.replace(/\s+/g, '-')}-${serviceDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // Map frontend report type to backend format
      const reportTypeMap: { [key: string]: string } = {
        'bait': 'bait_inspection',
        'fumigation': 'fumigation',
        'both': 'both'
      };

      let newReportId: number;

      // Step 1: Create the report (or use existing draft)
      const createPayload = {
        client_id: report.clientId,
        report_type: reportTypeMap[report.reportType] || report.reportType,
        service_date: report.serviceDate,
        next_service_date: report.nextServiceDate,
        pco_signature_data: report.pcoSignature,
        general_remarks: report.generalRemarks || null
      };

      const createResponse = await apiCall('/api/pco/reports', {
        method: 'POST',
        body: JSON.stringify(createPayload)
      });

      if (!createResponse.success) {
        // If there's an existing draft, delete it and try again
        if (createResponse.existing_draft_id) {
          await apiCall(`/api/pco/reports/${createResponse.existing_draft_id}`, {
            method: 'DELETE'
          });

          // Retry creating the report
          const retryResponse = await apiCall('/api/pco/reports', {
            method: 'POST',
            body: JSON.stringify(createPayload)
          });

          if (!retryResponse.success) {
            throw new Error(retryResponse.message || 'Failed to create report after deleting draft');
          }

          newReportId = retryResponse.report_id;
        } else {
          throw new Error(createResponse.message || 'Failed to create report');
        }
      } else {
        newReportId = createResponse.report_id;
      }

      setReportId(newReportId);

      // Step 2: Add bait stations if report type includes bait
      if ((report.reportType === 'bait' || report.reportType === 'both') && report.baitStations?.length > 0) {
        console.log('Adding', report.baitStations.length, 'bait stations...');
        
        for (const station of report.baitStations) {
          const baitStationPayload = {
            station_number: station.stationNumber,
            location: station.location, // 'inside' or 'outside'
            is_accessible: station.accessible,
            inaccessible_reason: station.accessReason || null,
            activity_detected: station.activityDetected,
            activity_droppings: station.activityTypes?.includes('droppings') || false,
            activity_gnawing: station.activityTypes?.includes('gnawing') || false,
            activity_tracks: station.activityTypes?.includes('tracks') || false,
            activity_other: station.activityTypes?.includes('other') || false,
            activity_other_description: station.activityTypes?.includes('other') ? station.activityOtherDesc : null,
            bait_status: station.baitStatus,
            station_condition: station.stationCondition,
            action_taken: station.actionTaken || 'none',
            warning_sign_condition: station.warningSignCondition,
            rodent_box_replaced: station.actionTaken === 'replaced' || false,
            station_remarks: station.remarks || null,
            chemicals: station.chemicalsUsed?.map((chem: any) => ({
              chemical_id: chem.chemicalId,
              quantity: chem.quantity,
              batch_number: chem.batchNumber
            })) || []
          };

          const baitResponse = await apiCall(`/api/pco/reports/${newReportId}/bait-stations`, {
            method: 'POST',
            body: JSON.stringify(baitStationPayload)
          });

          if (!baitResponse.success) {
            console.error('Failed to save bait station:', baitResponse);
            throw new Error(baitResponse.message || 'Failed to save bait station data');
          }
        }
      }

      // Step 3: Add fumigation data if report type includes fumigation
      if ((report.reportType === 'fumigation' || report.reportType === 'both') && report.fumigation) {
        // Prepare fumigation data payload
        const fumigationPayload = {
          areas: report.fumigation.areas?.map((area: string) => {
            const isOther = area === 'Other';
            return {
              area_name: area,
              is_other: isOther,
              ...(isOther && { other_description: report.fumigation.otherAreaDescription })
            };
          }) || [],
          target_pests: report.fumigation.pests?.map((pest: string) => {
            const isOther = pest === 'Other';
            return {
              pest_name: pest,
              is_other: isOther,
              ...(isOther && { other_description: report.fumigation.otherPestDescription })
            };
          }) || [],
          chemicals: report.fumigation.chemicals?.map((chem: any) => ({
            chemical_id: chem.chemicalId,
            quantity: Number(chem.quantity),
            batch_number: chem.batchNumber || null
          })) || []
        };

        // Submit all fumigation data in one request
        const fumigationResponse = await apiCall(`/api/pco/reports/${newReportId}/fumigation`, {
          method: 'PUT',
          body: JSON.stringify(fumigationPayload)
        });

        if (!fumigationResponse.success) {
          throw new Error(fumigationResponse.message || 'Failed to save fumigation data');
        }

        // Add insect monitors if any
        if (Array.isArray(report.fumigation.monitors) && report.fumigation.monitors.length > 0) {
          for (const monitor of report.fumigation.monitors) {
            const isFlyTrap = monitor.type === 'light';
            
            // Map frontend condition values to backend values
            let backendCondition = 'good';
            if (monitor.condition === 'needs_repair') {
              backendCondition = 'repaired';
            } else if (monitor.condition === 'damaged') {
              backendCondition = 'other';
            } else if (monitor.condition === 'missing') {
              backendCondition = 'replaced';
            } else if (monitor.condition === 'other') {
              backendCondition = 'other';
            } else if (monitor.condition === 'good') {
              backendCondition = 'good';
            }
            
            const monitorPayload: any = {
              monitor_type: isFlyTrap ? 'fly_trap' : 'box',
              monitor_condition: backendCondition,
              monitor_condition_other: monitor.conditionOther || null,
              warning_sign_condition: monitor.warningSignCondition || 'good',
              glue_board_replaced: isFlyTrap && monitor.glueBoard === 'replaced',
              monitor_serviced: true
            };

            // Add fly_trap specific fields
            if (isFlyTrap) {
              monitorPayload.light_condition = monitor.lightCondition || 'good';
              monitorPayload.light_faulty_type = monitor.lightCondition === 'faulty' && monitor.lightFaultyType ? monitor.lightFaultyType : 'na';
              monitorPayload.light_faulty_other = monitor.lightFaultyType === 'other' ? monitor.lightFaultyOther : null;
              monitorPayload.tubes_replaced = monitor.tubesCondition === 'replaced';
            } else {
              monitorPayload.light_condition = 'na';
              monitorPayload.light_faulty_type = 'na';
              monitorPayload.light_faulty_other = null;
              monitorPayload.tubes_replaced = null;
            }

            console.log('Submitting monitor:', JSON.stringify(monitorPayload, null, 2));

            const monitorResponse = await apiCall(`/api/pco/reports/${newReportId}/insect-monitors`, {
              method: 'POST',
              body: JSON.stringify(monitorPayload)
            });

            console.log('Monitor response:', JSON.stringify(monitorResponse, null, 2));

            if (!monitorResponse.success) {
              console.error('Failed to save monitor:', JSON.stringify(monitorResponse, null, 2));
              // Continue with other monitors even if one fails
            }
          }
        }

        // Add remarks if any
        if (report.fumigation.remarks) {
          await apiCall(`/api/pco/reports/${newReportId}`, {
            method: 'PUT',
            body: JSON.stringify({ general_remarks: report.fumigation.remarks })
          });
        }
      }

      // Step 4: Add client signature
      await apiCall(`/api/pco/reports/${newReportId}`, {
        method: 'PUT',
        body: JSON.stringify({
          client_signature_data: report.clientSignature,
          client_signature_name: report.clientName
        })
      });

      // Step 5: Submit the report for admin review
      const submitResponse = await apiCall(`/api/pco/reports/${newReportId}/submit`, {
        method: 'POST'
      });

      if (!submitResponse.success) {
        // Include missing requirements in error message if available
        let errorMsg = submitResponse.message || 'Failed to submit report';
        if (submitResponse.missing_requirements && Array.isArray(submitResponse.missing_requirements)) {
          errorMsg += '\n\nMissing: ' + submitResponse.missing_requirements.join(', ');
        }
        throw new Error(errorMsg);
      }

      // Success! Clear the report from localStorage
      localStorage.removeItem('current_report');

      // Show success message and redirect
      setSubmitting(false);
      
      // Navigate to success page or schedule
      setTimeout(() => {
        router.push('/pco/schedule?submitted=true');
      }, 2000);

    } catch (error: any) {
      console.error('Error submitting report:', error);
      setError(error.message || 'Failed to submit report. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ReportLayout currentStep={5} totalSteps={5} title="Submit Report">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ReportLayout>
    );
  }

  if (error && !submitting) {
    return (
      <ReportLayout currentStep={5} totalSteps={5} title="Submit Report">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-red-700 whitespace-pre-line">{error}</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => router.push('/pco/report/signature')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Back to Signature
                </button>
                {reportId && (
                  <button
                    onClick={() => setError(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </ReportLayout>
    );
  }

  // Success state
  if (submitting && reportId && !error) {
    return (
      <ReportLayout currentStep={5} totalSteps={5} title="Report Submitted">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-900 mb-2">Report Submitted Successfully!</h2>
          <p className="text-green-700 mb-4">
            Your report has been submitted for admin review. You will be notified once it's approved.
          </p>
          <p className="text-sm text-gray-600">
            Redirecting to schedule...
          </p>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout currentStep={5} totalSteps={5} title="Submit Report">
      <div className="space-y-6">
        {/* Final Review */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Final Review
          </h2>
          <p className="text-gray-700 mb-4">
            Please review all information before submitting. Once submitted, the report will be sent to admin for approval.
          </p>
        </div>

        {/* Client & Service Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Service Information</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Company Name</p>
                <p className="font-medium text-gray-900">{report?.client?.company_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{report?.client?.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Service Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(report?.serviceDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Next Service Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(report?.nextServiceDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Beaker className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Report Type</p>
                <p className="font-medium text-gray-900 capitalize">
                  {report?.reportType === 'both' ? 'Bait Inspection + Fumigation' : report?.reportType}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Services Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Services Completed</h3>
          
          <div className="space-y-3">
            {(report?.reportType === 'bait' || report?.reportType === 'both') && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Bait Station Inspection</p>
                  <p className="text-sm text-gray-600">
                    {report?.baitStations?.length || 0} stations inspected
                  </p>
                </div>
              </div>
            )}

            {(report?.reportType === 'fumigation' || report?.reportType === 'both') && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Fumigation Service</p>
                  <p className="text-sm text-gray-600">
                    {report?.fumigation?.areas?.length || 0} areas treated, {' '}
                    {report?.fumigation?.chemicals?.length || 0} chemicals used
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Client Signature</p>
                <p className="text-sm text-gray-600">Signed by: {report?.clientName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Download Backup */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-yellow-900 text-sm mb-3">
            <strong>Recommended:</strong> Download a backup copy of this report before submitting.
          </p>
          <button
            onClick={downloadJSON}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
          >
            <Download className="w-5 h-5" />
            Download Backup (JSON)
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/pco/report/signature')}
            disabled={submitting}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Report
              </>
            )}
          </button>
        </div>

        {/* Important Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 text-center">
            By submitting this report, you confirm that all information is accurate and complete.
            The report will be reviewed by an administrator before final approval.
          </p>
        </div>
      </div>
    </ReportLayout>
  );
}
