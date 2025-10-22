'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReportLayout from '@/components/ReportLayout';
import TextBox from '@/components/TextBox';
import TextArea from '@/components/TextArea';
import AlertModal from '@/components/AlertModal';
import { useAlert } from '@/hooks/useAlert';
import { Calendar, Edit, FileText, AlertCircle, Beaker, MapPin } from 'lucide-react';

interface BaitStation {
  id: string;
  location: 'inside' | 'outside';
  stationNumber: string;
  accessible: boolean;
  accessReason?: string;
  activityDetected: boolean;
  activityTypes?: string[];
  baitStatus: 'clean' | 'eaten' | 'wet' | 'old';
  stationCondition: 'good' | 'needs_repair' | 'damaged' | 'missing';
  actionTaken?: 'repaired' | 'replaced';
  warningSignCondition: 'good' | 'replaced' | 'repaired' | 'remounted';
  chemicalsUsed: Array<{
    chemicalId: number;
    chemicalName: string;
    quantity: number;
    batchNumber: string;
  }>;
  remarks?: string;
}

interface FumigationData {
  areas: string[];
  pests: string[];
  chemicals: Array<{
    chemicalId: number;
    chemicalName: string;
    quantity: number;
    batchNumber: string;
  }>;
  monitors: Array<{
    id: string;
    type: string;
    location: string;
    monitorNumber: string;
    condition: string;
  }> | number;
  remarks: string;
}

export default function ReportSummary() {
  const router = useRouter();
  const alert = useAlert();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [nextServiceDate, setNextServiceDate] = useState<string>('');
  const [generalRemarks, setGeneralRemarks] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
      
      // Validate required data based on report type
      if (reportData.reportType === 'bait' && !reportData.baitStations?.length) {
        setError('No bait station data found. Please complete the bait inspection.');
        setLoading(false);
        return;
      }

      if (reportData.reportType === 'fumigation' && !reportData.fumigation) {
        setError('No fumigation data found. Please complete the fumigation service.');
        setLoading(false);
        return;
      }

      if (reportData.reportType === 'both' && (!reportData.baitStations?.length || !reportData.fumigation)) {
        setError('Incomplete report data. Please complete both services.');
        setLoading(false);
        return;
      }

      setReport(reportData);
      
      // Set default next service date (30 days from service date)
      const serviceDate = new Date(reportData.serviceDate);
      const defaultNextService = new Date(serviceDate);
      defaultNextService.setDate(defaultNextService.getDate() + 30);
      setNextServiceDate(defaultNextService.toISOString().split('T')[0]);
      
      // Load general remarks if they exist
      setGeneralRemarks(reportData.generalRemarks || '');
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading report:', error);
      setError('Failed to load report data');
      setLoading(false);
    }
  };

  const handleEdit = (section: 'setup' | 'bait' | 'fumigation') => {
    if (section === 'setup') {
      router.push(`/pco/report/new?clientId=${report.clientId}`);
    } else if (section === 'bait') {
      router.push('/pco/report/bait-inspection');
    } else if (section === 'fumigation') {
      router.push('/pco/report/fumigation');
    }
  };

  const handleContinue = () => {
    if (!nextServiceDate) {
      alert.showWarning('Please select a next service date', 'Missing Information');
      return;
    }

    // Save next service date and general remarks to report
    const updatedReport = {
      ...report,
      nextServiceDate,
      generalRemarks,
      step: 'signature',
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('current_report', JSON.stringify(updatedReport));
    
    // Navigate to client signature
    router.push('/pco/report/signature');
  };

  if (loading) {
    return (
      <ReportLayout currentStep={3} totalSteps={5} title="Summary">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ReportLayout>
    );
  }

  if (error) {
    return (
      <ReportLayout currentStep={3} totalSteps={5} title="Summary">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => router.push('/pco/schedule')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Back to Schedule
              </button>
            </div>
          </div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout currentStep={3} totalSteps={5} title="Report Summary">
      <div className="space-y-6">
        {/* Client Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Client Information
            </h2>
            <button
              onClick={() => handleEdit('setup')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </div>
          
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
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Address
              </p>
              <p className="font-medium text-gray-900">{report?.client?.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Report Type</p>
              <p className="font-medium text-gray-900 capitalize">
                {report?.reportType === 'both' ? 'Bait Inspection + Fumigation' : report?.reportType}
              </p>
            </div>
          </div>
        </div>

        {/* Bait Station Summary */}
        {(report?.reportType === 'bait' || report?.reportType === 'both') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Bait Station Inspection
              </h2>
              <button
                onClick={() => handleEdit('bait')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {report?.baitStations?.filter((s: BaitStation) => s.stationCondition === 'good').length || 0}
                </p>
                <p className="text-sm text-gray-600">Good Condition</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {report?.baitStations?.filter((s: BaitStation) => s.stationCondition === 'needs_repair').length || 0}
                </p>
                <p className="text-sm text-gray-600">Needs Repair</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {report?.baitStations?.filter((s: BaitStation) => s.actionTaken === 'replaced').length || 0}
                </p>
                <p className="text-sm text-gray-600">Replaced</p>
              </div>
            </div>

            <div className="space-y-2">
              {report?.baitStations?.map((station: BaitStation) => (
                <div key={station.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Station #{station.stationNumber} - {station.location === 'inside' ? 'Inside' : 'Outside'}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      Condition: {station.stationCondition?.replace('_', ' ') || 'N/A'} • 
                      Bait: {station.baitStatus || 'N/A'}
                      {station.activityDetected && ' • ⚠️ Activity Detected'}
                    </p>
                  </div>
                  {station.chemicalsUsed?.length > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-gray-900">
                        {station.chemicalsUsed.map(c => c.chemicalName).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fumigation Summary */}
        {(report?.reportType === 'fumigation' || report?.reportType === 'both') && report?.fumigation && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Beaker className="w-5 h-5 text-purple-600" />
                Fumigation Service
              </h2>
              <button
                onClick={() => handleEdit('fumigation')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Areas Treated</p>
                <div className="flex flex-wrap gap-2">
                  {report.fumigation.areas?.map((area: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Pests Targeted</p>
                <div className="flex flex-wrap gap-2">
                  {report.fumigation.pests?.map((pest: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                      {pest}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Chemicals Used</p>
                <div className="space-y-2">
                  {report.fumigation.chemicals?.map((chem: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900">{chem.chemicalName}</span>
                      <span className="text-sm text-gray-600">
                        {chem.quantity} units • Batch: {chem.batchNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Monitors Placed</p>
                <p className="font-medium text-gray-900">
                  {Array.isArray(report.fumigation.monitors) ? report.fumigation.monitors.length : (report.fumigation.monitors || 0)} monitors
                </p>
              </div>

              {report.fumigation.remarks && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Remarks</p>
                  <p className="text-gray-900">{report.fumigation.remarks}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* General Remarks - Unified for all report types */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-gray-600" />
            General Remarks
          </h2>
          <TextArea
            value={generalRemarks}
            onChange={(e) => setGeneralRemarks(e.target.value)}
            rows={4}
            placeholder="Additional observations, recommendations, or notes about this service..."
            resize="vertical"
          />
        </div>

        {/* Next Service Date */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            Next Service Date
          </h2>
          
          <TextBox
            type="date"
            value={nextServiceDate}
            onChange={(e) => setNextServiceDate(e.target.value)}
            min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
            helperText="Must be a future date. Recommended: 30 days from service date"
            required
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!nextServiceDate}
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
