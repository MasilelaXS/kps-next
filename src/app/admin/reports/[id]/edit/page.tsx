'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useNotification } from '@/contexts/NotificationContext';
import TextBox from '@/components/TextBox';
import TextArea from '@/components/TextArea';
import {
  FileText,
  Save,
  X,
  Plus,
  Trash2,
  ArrowLeft,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Chemical {
  id?: number;
  chemical_id: number;
  chemical_name?: string;
  quantity: number;
  batch_number: string;
}

interface BaitStation {
  id?: number;
  report_id?: number;
  location: 'inside' | 'outside';
  station_number: string;
  accessible: 'yes' | 'no';
  not_accessible_reason?: string;
  activity_detected: 'yes' | 'no';
  activity_droppings?: boolean;
  activity_gnawing?: boolean;
  activity_tracks?: boolean;
  activity_other?: boolean;
  activity_other_description?: string;
  bait_status: 'clean' | 'eaten' | 'wet' | 'old';
  station_condition: 'good' | 'needs_repair' | 'damaged' | 'missing';
  action_taken?: 'repaired' | 'replaced' | '';
  warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted';
  station_remarks?: string;
  chemicals: Chemical[];
}

interface FumigationArea {
  id?: number;
  report_id?: number;
  area_name: string;
  is_other?: boolean;
  other_description?: string;
}

interface FumigationTargetPest {
  id?: number;
  report_id?: number;
  pest_name: string;
  is_other?: boolean;
  other_description?: string;
}

interface FumigationChemical {
  id?: number;
  report_id?: number;
  chemical_id: number;
  chemical_name?: string;
  quantity: number;
  batch_number: string;
}

interface InsectMonitor {
  id?: number;
  report_id?: number;
  monitor_type: 'box' | 'fly_trap';
  monitor_condition: 'good' | 'replaced' | 'repaired' | 'other';
  monitor_condition_other?: string;
  light_condition?: 'good' | 'faulty' | '';
  light_faulty_type?: 'starter' | 'tube' | 'cable' | 'electricity' | 'other' | '';
  light_faulty_other?: string;
  glue_board_replaced?: 'yes' | 'no' | '' | number;
  tubes_replaced?: 'yes' | 'no' | '' | number;
  warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted';
  monitor_serviced: 'yes' | 'no' | number;
}

interface Report {
  id: number;
  client_id: number;
  client_name: string;
  company_name?: string;
  pco_id: number;
  pco_name: string;
  report_type: 'bait_inspection' | 'fumigation' | 'both';
  service_date: string;
  next_service_date?: string;
  status: 'draft' | 'pending' | 'approved' | 'declined' | 'archived';
  general_remarks?: string; // Read-only for admin
  recommendations?: string;
  admin_notes?: string;
  pco_signature?: string; // Read-only for admin
  client_signature?: string; // Read-only for admin
  client_signature_name?: string;
  bait_stations?: BaitStation[];
  fumigation?: {
    areas: FumigationArea[];
    target_pests: FumigationTargetPest[];
    chemicals: FumigationChemical[];
  };
  insect_monitors?: InsectMonitor[];
}

interface AvailableChemical {
  id: number;
  name: string;
  active_ingredients?: string;
  usage_type: string;
  quantity_unit: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AREAS = [
  'Kitchen', 'Storage Room', 'Loading Dock', 'Dining Area',
  'Prep Area', 'Main Kitchen', 'Dining Hall', 'Bathroom',
  'Office', 'Warehouse', 'Other'
];

const TARGET_PESTS = [
  'Cockroaches', 'Ants', 'Flies', 'Moths',
  'Spiders', 'Beetles', 'Termites', 'Other'
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EditReportPage() {
  const router = useRouter();
  const params = useParams();
  const notification = useNotification();
  const reportId = params?.id as string;

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [availableChemicals, setAvailableChemicals] = useState<AvailableChemical[]>([]);

  // Form state
  const [serviceDate, setServiceDate] = useState('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [reportType, setReportType] = useState<'bait_inspection' | 'fumigation' | 'both'>('bait_inspection');
  const [status, setStatus] = useState<'draft' | 'pending' | 'approved' | 'declined' | 'archived'>('pending');
  const [recommendations, setRecommendations] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [baitStations, setBaitStations] = useState<BaitStation[]>([]);
  const [fumigationAreas, setFumigationAreas] = useState<FumigationArea[]>([]);
  const [fumigationPests, setFumigationPests] = useState<FumigationTargetPest[]>([]);
  const [fumigationChemicals, setFumigationChemicals] = useState<FumigationChemical[]>([]);
  const [insectMonitors, setInsectMonitors] = useState<InsectMonitor[]>([]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (reportId) {
      console.log('🔄 useEffect triggered - loading report and chemicals for reportId:', reportId);
      Promise.all([fetchReport(), fetchChemicals()]).then(() => {
        console.log('✅ All data loaded (report + chemicals)');
      }).catch(err => {
        console.error('❌ Error loading data:', err);
      });
    }
  }, [reportId]);

  // Debug: Log when chemicals are loaded
  useEffect(() => {
    console.log('Available chemicals state updated:', availableChemicals.length, 'chemicals');
  }, [availableChemicals]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');

      const response = await fetch(`http://192.168.1.128:3001/api/admin/reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success && data.data) {
        const reportData = data.data;
        setReport(reportData);

        // Set form values
        setServiceDate(reportData.service_date.split('T')[0]);
        setNextServiceDate(reportData.next_service_date ? reportData.next_service_date.split('T')[0] : '');
        setReportType(reportData.report_type);
        setStatus(reportData.status);
        setRecommendations(reportData.recommendations || '');
        setAdminNotes(reportData.admin_notes || '');
        
        // Normalize bait stations to ensure no null values in input fields
        const normalizedStations = (reportData.bait_stations || []).map((s: BaitStation) => ({
          ...s,
          not_accessible_reason: s.not_accessible_reason || '',
          activity_other_description: s.activity_other_description || '',
          station_remarks: s.station_remarks || '',
          action_taken: s.action_taken || ''
        }));
        setBaitStations(normalizedStations);
        
        // Normalize insect monitors to ensure no null values in input fields
        const normalizedMonitors = (reportData.insect_monitors || []).map((m: InsectMonitor) => ({
          ...m,
          monitor_condition_other: m.monitor_condition_other || '',
          light_condition: m.light_condition || '',
          light_faulty_type: m.light_faulty_type || '',
          light_faulty_other: m.light_faulty_other || '',
          glue_board_replaced: m.glue_board_replaced ?? '',
          tubes_replaced: m.tubes_replaced ?? ''
        }));
        setInsectMonitors(normalizedMonitors);

        // Set fumigation data with normalization
        if (reportData.fumigation) {
          const normalizedAreas = (reportData.fumigation.areas || []).map((a: FumigationArea) => ({
            ...a,
            other_description: a.other_description || ''
          }));
          const normalizedPests = (reportData.fumigation.target_pests || []).map((p: FumigationTargetPest) => ({
            ...p,
            other_description: p.other_description || ''
          }));
          setFumigationAreas(normalizedAreas);
          setFumigationPests(normalizedPests);
          setFumigationChemicals(reportData.fumigation.chemicals || []);
        }
      } else {
        notification.error('Load Failed', 'Failed to load report details');
        router.push('/admin/reports');
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      notification.error('Load Failed', 'Failed to load report details');
      router.push('/admin/reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchChemicals = async () => {
    try {
      const token = localStorage.getItem('kps_token');
      console.log('Fetching chemicals with token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        console.error('No authentication token found');
        notification.error('Authentication Error', 'Please log in again');
        return;
      }
      
      const response = await fetch('http://192.168.1.128:3001/api/admin/chemicals?status=active&limit=100', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Chemicals API response status:', response.status);
      console.log('Chemicals API response ok:', response.ok);
      
      if (!response.ok) {
        console.error('Chemicals API error:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error response:', errorData);
        notification.error('Failed to Load Chemicals', `Error: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      console.log('Chemicals API response data:', data);
      console.log('Data structure check - data.success:', data.success);
      console.log('Data structure check - data.data exists:', !!data.data);
      console.log('Data structure check - data.data.chemicals:', data.data?.chemicals);
      
      if (data.success && data.data && Array.isArray(data.data.chemicals)) {
        console.log('✅ Setting available chemicals:', data.data.chemicals.length, 'chemicals found');
        setAvailableChemicals(data.data.chemicals);
      } else {
        console.warn('❌ Invalid chemicals response format:', data);
        notification.warning('Chemicals Loading Issue', 'Response format unexpected');
      }
    } catch (error) {
      console.error('❌ Error fetching chemicals:', error);
      notification.error('Failed to Load Chemicals', error instanceof Error ? error.message : 'Network error');
    }
  };

  // ============================================================================
  // SAVE FUNCTION
  // ============================================================================

  const handleSave = async () => {
    try {
      setSaving(true);

      const token = localStorage.getItem('kps_token');

      // Build payload
      const payload: any = {
        service_date: serviceDate,
        next_service_date: nextServiceDate || null,
        report_type: reportType,
        status: status,
        recommendations: recommendations || null,
        admin_notes: adminNotes || null,
        bait_stations: baitStations,
        fumigation_areas: fumigationAreas,
        fumigation_target_pests: fumigationPests,
        fumigation_chemicals: fumigationChemicals,
        insect_monitors: insectMonitors
      };

      const response = await fetch(`http://192.168.1.128:3001/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save report');
      }

      notification.success('Saved!', 'Report updated successfully');
      router.push('/admin/reports');
    } catch (error) {
      console.error('Error saving report:', error);
      notification.error('Save Failed', error instanceof Error ? error.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <DashboardLayout >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading report...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Report not found</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/reports')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-7 h-7 text-purple-600" />
                Edit Report #{report.id}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {report.company_name || report.client_name} - {report.pco_name}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin/reports')}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 inline mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Form */}
        <div className="space-y-6">
          {/* Basic Information Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Basic Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <TextBox
                label="Service Date"
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
                helperText="Cannot be in the future"
              />
              <TextBox
                label="Next Service Date"
                type="date"
                value={nextServiceDate}
                onChange={(e) => setNextServiceDate(e.target.value)}
                min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                helperText="Must be a future date"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="bait_inspection">Bait Inspection</option>
                  <option value="fumigation">Fumigation</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Admin Notes Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Admin Notes & Recommendations
            </h2>
            <div className="space-y-4">
              <TextArea
                label="Recommendations (Admin Only)"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                rows={4}
                placeholder="Add recommendations for the client..."
              />
              <TextArea
                label="Admin Notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Internal admin notes (not visible to client)..."
              />
              {report.general_remarks && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PCO Remarks (Read-Only)
                  </label>
                  <p className="text-sm text-gray-700">{report.general_remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bait Stations Section */}
          {(reportType === 'bait_inspection' || reportType === 'both') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Bait Stations
                </h2>
                <button
                  onClick={() => {
                    const newStation: BaitStation = {
                      location: 'inside',
                      station_number: '',
                      accessible: 'yes',
                      activity_detected: 'no',
                      bait_status: 'clean',
                      station_condition: 'good',
                      action_taken: '',
                      warning_sign_condition: 'good',
                      chemicals: []
                    };
                    setBaitStations([...baitStations, newStation]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Station
                </button>
              </div>

              {baitStations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No bait stations added yet</p>
                  <p className="text-sm mt-1">Click "Add Station" to create one</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Group by location */}
                  {['inside', 'outside'].map((location) => {
                    const stationsInLocation = baitStations.filter(s => s.location === location);
                    if (stationsInLocation.length === 0) return null;

                    return (
                      <div key={location} className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-medium text-gray-900 mb-4 capitalize">
                          {location} Stations ({stationsInLocation.length})
                        </h3>
                        <div className="space-y-4">
                          {baitStations.map((station, index) => {
                            if (station.location !== location) return null;
                            
                            return (
                              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                {/* Station header with delete button */}
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-medium text-gray-800">
                                    Station #{index + 1}
                                  </h4>
                                  <button
                                    onClick={() => {
                                      setBaitStations(baitStations.filter((_, i) => i !== index));
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Location */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Location
                                    </label>
                                    <select
                                      value={station.location}
                                      onChange={(e) => {
                                        const updated = [...baitStations];
                                        updated[index].location = e.target.value as 'inside' | 'outside';
                                        setBaitStations(updated);
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    >
                                      <option value="inside">Inside</option>
                                      <option value="outside">Outside</option>
                                    </select>
                                  </div>

                                  {/* Station Number */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Station Number
                                    </label>
                                    <input
                                      type="text"
                                      value={station.station_number}
                                      onChange={(e) => {
                                        const updated = [...baitStations];
                                        updated[index].station_number = e.target.value as any;
                                        setBaitStations(updated);
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      placeholder="e.g., IS-001"
                                    />
                                  </div>

                                  {/* Accessible */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Accessible
                                    </label>
                                    <select
                                      value={station.accessible}
                                      onChange={(e) => {
                                        const updated = [...baitStations];
                                        updated[index].accessible = e.target.value as 'yes' | 'no';
                                        setBaitStations(updated);
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    >
                                      <option value="yes">Yes</option>
                                      <option value="no">No</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Not Accessible Reason (conditional) */}
                                {station.accessible === 'no' && (
                                  <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Reason Not Accessible
                                    </label>
                                    <input
                                      type="text"
                                      value={station.not_accessible_reason || ''}
                                      onChange={(e) => {
                                        const updated = [...baitStations];
                                        updated[index].not_accessible_reason = e.target.value;
                                        setBaitStations(updated);
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      placeholder="e.g., Locked gate, Under construction"
                                    />
                                  </div>
                                )}

                                {/* Activity Detection */}
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <h5 className="font-medium text-gray-800 mb-3">Activity Detection</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Activity Detected
                                      </label>
                                      <select
                                        value={station.activity_detected}
                                        onChange={(e) => {
                                          const updated = [...baitStations];
                                          updated[index].activity_detected = e.target.value as 'yes' | 'no';
                                          setBaitStations(updated);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      >
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Activity Type Checkboxes */}
                                  {station.activity_detected === 'yes' && (
                                    <div className="mt-3 space-y-2">
                                      <label className="block text-sm font-medium text-gray-700">Activity Types:</label>
                                      <div className="grid grid-cols-2 gap-2">
                                        <label className="flex items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={station.activity_droppings || false}
                                            onChange={(e) => {
                                              const updated = [...baitStations];
                                              updated[index].activity_droppings = e.target.checked;
                                              setBaitStations(updated);
                                            }}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                          />
                                          Droppings
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={station.activity_gnawing || false}
                                            onChange={(e) => {
                                              const updated = [...baitStations];
                                              updated[index].activity_gnawing = e.target.checked;
                                              setBaitStations(updated);
                                            }}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                          />
                                          Gnawing
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={station.activity_tracks || false}
                                            onChange={(e) => {
                                              const updated = [...baitStations];
                                              updated[index].activity_tracks = e.target.checked;
                                              setBaitStations(updated);
                                            }}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                          />
                                          Tracks
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={station.activity_other || false}
                                            onChange={(e) => {
                                              const updated = [...baitStations];
                                              updated[index].activity_other = e.target.checked;
                                              if (!e.target.checked) {
                                                updated[index].activity_other_description = undefined;
                                              }
                                              setBaitStations(updated);
                                            }}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                          />
                                          Other
                                        </label>
                                      </div>
                                      {station.activity_other && (
                                        <input
                                          type="text"
                                          value={station.activity_other_description || ''}
                                          onChange={(e) => {
                                            const updated = [...baitStations];
                                            updated[index].activity_other_description = e.target.value;
                                            setBaitStations(updated);
                                          }}
                                          placeholder="Describe other activity..."
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Station Condition & Action */}
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <h5 className="font-medium text-gray-800 mb-3">Station Status</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Bait Status
                                      </label>
                                      <select
                                        value={station.bait_status}
                                        onChange={(e) => {
                                          const updated = [...baitStations];
                                          updated[index].bait_status = e.target.value as any;
                                          setBaitStations(updated);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      >
                                        <option value="clean">Clean</option>
                                        <option value="eaten">Eaten</option>
                                        <option value="wet">Wet</option>
                                        <option value="old">Old</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Station Condition
                                      </label>
                                      <select
                                        value={station.station_condition}
                                        onChange={(e) => {
                                          const updated = [...baitStations];
                                          updated[index].station_condition = e.target.value as any;
                                          setBaitStations(updated);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      >
                                        <option value="good">Good</option>
                                        <option value="needs_repair">Needs Repair</option>
                                        <option value="damaged">Damaged</option>
                                        <option value="missing">Missing</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Action Taken
                                      </label>
                                      <select
                                        value={station.action_taken || ''}
                                        onChange={(e) => {
                                          const updated = [...baitStations];
                                          updated[index].action_taken = e.target.value as any;
                                          setBaitStations(updated);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      >
                                        <option value="">None</option>
                                        <option value="repaired">Repaired</option>
                                        <option value="replaced">Replaced</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Warning Sign Condition
                                      </label>
                                      <select
                                        value={station.warning_sign_condition}
                                        onChange={(e) => {
                                          const updated = [...baitStations];
                                          updated[index].warning_sign_condition = e.target.value as any;
                                          setBaitStations(updated);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      >
                                        <option value="good">Good</option>
                                        <option value="replaced">Replaced</option>
                                        <option value="repaired">Repaired</option>
                                        <option value="remounted">Remounted</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                {/* Station Remarks */}
                                <div className="mt-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Station Remarks
                                  </label>
                                  <textarea
                                    value={station.station_remarks || ''}
                                    onChange={(e) => {
                                      const updated = [...baitStations];
                                      updated[index].station_remarks = e.target.value;
                                      setBaitStations(updated);
                                    }}
                                    rows={2}
                                    placeholder="Additional notes about this station..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                                  />
                                </div>

                                {/* Chemicals Section */}
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-medium text-gray-800">Chemicals Used</h5>
                                    <button
                                      onClick={() => {
                                        const updated = [...baitStations];
                                        updated[index].chemicals.push({
                                          chemical_id: 0,
                                          quantity: 0,
                                          batch_number: ''
                                        });
                                        setBaitStations(updated);
                                      }}
                                      className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                                    >
                                      + Add Chemical
                                    </button>
                                  </div>
                                  
                                  {station.bait_status === 'clean' && station.chemicals.length === 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                      <p className="text-sm text-blue-700">
                                        ℹ️ Bait status is "Clean" (no poison). Chemicals are typically not needed unless bait was replenished.
                                      </p>
                                    </div>
                                  )}
                                  
                                  {station.chemicals.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No chemicals added</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {station.chemicals.map((chem, chemIndex) => (
                                        <div key={chemIndex} className="flex gap-2 items-start">
                                          <select
                                            value={chem.chemical_id}
                                            onChange={(e) => {
                                              const updated = [...baitStations];
                                              updated[index].chemicals[chemIndex].chemical_id = parseInt(e.target.value);
                                              setBaitStations(updated);
                                            }}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                          >
                                            <option value={0}>Select chemical... ({availableChemicals.length} available)</option>
                                            {availableChemicals.length === 0 && (
                                              <option disabled>Loading chemicals...</option>
                                            )}
                                            {availableChemicals.map(c => (
                                              <option key={c.id} value={c.id}>{c.name} ({c.quantity_unit})</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            value={chem.quantity}
                                            onChange={(e) => {
                                              const updated = [...baitStations];
                                              updated[index].chemicals[chemIndex].quantity = parseFloat(e.target.value) || 0;
                                              setBaitStations(updated);
                                            }}
                                            placeholder="Qty"
                                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                          />
                                          <input
                                            type="text"
                                            value={chem.batch_number}
                                            onChange={(e) => {
                                              const updated = [...baitStations];
                                              updated[index].chemicals[chemIndex].batch_number = e.target.value;
                                              setBaitStations(updated);
                                            }}
                                            placeholder="Batch #"
                                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                          />
                                          <button
                                            onClick={() => {
                                              const updated = [...baitStations];
                                              updated[index].chemicals = updated[index].chemicals.filter((_, i) => i !== chemIndex);
                                              setBaitStations(updated);
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FUMIGATION SECTION */}
          {(reportType === 'fumigation' || reportType === 'both') && (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <FileText className="w-6 h-6 text-purple-600" />
                Fumigation Details
              </h2>

              {/* Fumigation Areas */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-lg font-semibold text-gray-800">
                    Fumigation Areas
                  </label>
                  <button
                    onClick={() => {
                      setFumigationAreas([...fumigationAreas, { area_name: '', is_other: false, other_description: '' }]);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Area
                  </button>
                </div>
                <div className="space-y-3">
                  {fumigationAreas.map((area, index) => (
                    <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1">
                        <select
                          value={area.area_name}
                          onChange={(e) => {
                            const updated = [...fumigationAreas];
                            updated[index].area_name = e.target.value;
                            updated[index].is_other = e.target.value === 'Other';
                            setFumigationAreas(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">Select area...</option>
                          {AREAS.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                        {area.is_other && (
                          <input
                            type="text"
                            value={area.other_description || ''}
                            onChange={(e) => {
                              const updated = [...fumigationAreas];
                              updated[index].other_description = e.target.value;
                              setFumigationAreas(updated);
                            }}
                            placeholder="Describe the area..."
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setFumigationAreas(fumigationAreas.filter((_, i) => i !== index));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {fumigationAreas.length === 0 && (
                    <p className="text-gray-500 italic text-center py-4">No fumigation areas added</p>
                  )}
                </div>
              </div>

              {/* Target Pests */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-lg font-semibold text-gray-800">
                    Target Pests
                  </label>
                  <button
                    onClick={() => {
                      setFumigationPests([...fumigationPests, { pest_name: '', is_other: false, other_description: '' }]);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Pest
                  </button>
                </div>
                <div className="space-y-3">
                  {fumigationPests.map((pest, index) => (
                    <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1">
                        <select
                          value={pest.pest_name}
                          onChange={(e) => {
                            const updated = [...fumigationPests];
                            updated[index].pest_name = e.target.value;
                            updated[index].is_other = e.target.value === 'Other';
                            setFumigationPests(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">Select pest...</option>
                          {TARGET_PESTS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {pest.is_other && (
                          <input
                            type="text"
                            value={pest.other_description || ''}
                            onChange={(e) => {
                              const updated = [...fumigationPests];
                              updated[index].other_description = e.target.value;
                              setFumigationPests(updated);
                            }}
                            placeholder="Describe the pest..."
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setFumigationPests(fumigationPests.filter((_, i) => i !== index));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {fumigationPests.length === 0 && (
                    <p className="text-gray-500 italic text-center py-4">No target pests added</p>
                  )}
                </div>
              </div>

              {/* Fumigation Chemicals */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-lg font-semibold text-gray-800">
                    Chemicals Used
                  </label>
                  <button
                    onClick={() => {
                      setFumigationChemicals([...fumigationChemicals, { chemical_id: 0, quantity: 0, batch_number: '' }]);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Chemical
                  </button>
                </div>
                <div className="space-y-3">
                  {fumigationChemicals.map((chem, index) => (
                    <div key={index} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg">
                      <select
                        value={chem.chemical_id}
                        onChange={(e) => {
                          const updated = [...fumigationChemicals];
                          updated[index].chemical_id = parseInt(e.target.value);
                          setFumigationChemicals(updated);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value={0}>Select chemical... ({availableChemicals.length} available)</option>
                        {availableChemicals.length === 0 && (
                          <option disabled>Loading chemicals...</option>
                        )}
                        {availableChemicals.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.quantity_unit})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={chem.quantity}
                        onChange={(e) => {
                          const updated = [...fumigationChemicals];
                          updated[index].quantity = parseFloat(e.target.value) || 0;
                          setFumigationChemicals(updated);
                        }}
                        placeholder="Quantity"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={chem.batch_number}
                        onChange={(e) => {
                          const updated = [...fumigationChemicals];
                          updated[index].batch_number = e.target.value;
                          setFumigationChemicals(updated);
                        }}
                        placeholder="Batch Number"
                        className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          setFumigationChemicals(fumigationChemicals.filter((_, i) => i !== index));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {fumigationChemicals.length === 0 && (
                    <p className="text-gray-500 italic text-center py-4">No chemicals added</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* INSECT MONITORS SECTION */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-purple-600" />
                Insect Monitors
              </h2>
              <button
                onClick={() => {
                  setInsectMonitors([...insectMonitors, {
                    monitor_type: 'box',
                    monitor_condition: 'good',
                    monitor_condition_other: '',
                    warning_sign_condition: 'good',
                    monitor_serviced: 'yes',
                    glue_board_replaced: '',
                    tubes_replaced: '',
                    light_condition: '',
                    light_faulty_type: '',
                    light_faulty_other: ''
                  }]);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Monitor
              </button>
            </div>

            {insectMonitors.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No insect monitors added</p>
            ) : (
              <div className="space-y-4">
                {insectMonitors.map((monitor, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">Monitor #{index + 1}</h3>
                      <button
                        onClick={() => {
                          setInsectMonitors(insectMonitors.filter((_, i) => i !== index));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Monitor Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Monitor Type *
                        </label>
                        <select
                          value={monitor.monitor_type}
                          onChange={(e) => {
                            const updated = [...insectMonitors];
                            updated[index].monitor_type = e.target.value as 'box' | 'fly_trap';
                            // Clear light fields if switching to box
                            if (e.target.value === 'box') {
                              updated[index].light_condition = '';
                              updated[index].light_faulty_type = '';
                              updated[index].light_faulty_other = '';
                            }
                            setInsectMonitors(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="box">Box</option>
                          <option value="fly_trap">Fly Trap</option>
                        </select>
                      </div>

                      {/* Monitor Condition */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Monitor Condition *
                        </label>
                        <select
                          value={monitor.monitor_condition}
                          onChange={(e) => {
                            const updated = [...insectMonitors];
                            updated[index].monitor_condition = e.target.value as any;
                            if (e.target.value !== 'other') {
                              updated[index].monitor_condition_other = '';
                            }
                            setInsectMonitors(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="good">Good</option>
                          <option value="replaced">Replaced</option>
                          <option value="repaired">Repaired</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Monitor Condition Other */}
                      {monitor.monitor_condition === 'other' && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Describe Condition
                          </label>
                          <input
                            type="text"
                            value={monitor.monitor_condition_other || ''}
                            onChange={(e) => {
                              const updated = [...insectMonitors];
                              updated[index].monitor_condition_other = e.target.value;
                              setInsectMonitors(updated);
                            }}
                            placeholder="Describe the condition..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      {/* Light fields - only for fly_trap */}
                      {monitor.monitor_type === 'fly_trap' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Light Condition
                            </label>
                            <select
                              value={monitor.light_condition || ''}
                              onChange={(e) => {
                                const updated = [...insectMonitors];
                                updated[index].light_condition = e.target.value as any;
                                if (e.target.value !== 'faulty') {
                                  updated[index].light_faulty_type = '';
                                  updated[index].light_faulty_other = '';
                                }
                                setInsectMonitors(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              <option value="">N/A</option>
                              <option value="good">Good</option>
                              <option value="faulty">Faulty</option>
                            </select>
                          </div>

                          {monitor.light_condition === 'faulty' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Faulty Type
                                </label>
                                <select
                                  value={monitor.light_faulty_type || ''}
                                  onChange={(e) => {
                                    const updated = [...insectMonitors];
                                    updated[index].light_faulty_type = e.target.value as any;
                                    if (e.target.value !== 'other') {
                                      updated[index].light_faulty_other = '';
                                    }
                                    setInsectMonitors(updated);
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                  <option value="">Select...</option>
                                  <option value="starter">Starter</option>
                                  <option value="tube">Tube</option>
                                  <option value="cable">Cable</option>
                                  <option value="electricity">Electricity</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>

                              {monitor.light_faulty_type === 'other' && (
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Describe Faulty Issue
                                  </label>
                                  <input
                                    type="text"
                                    value={monitor.light_faulty_other || ''}
                                    onChange={(e) => {
                                      const updated = [...insectMonitors];
                                      updated[index].light_faulty_other = e.target.value;
                                      setInsectMonitors(updated);
                                    }}
                                    placeholder="Describe the issue..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* Checkboxes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Glue Board Replaced
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={monitor.glue_board_replaced === 'yes' || monitor.glue_board_replaced === 1}
                              onChange={() => {
                                const updated = [...insectMonitors];
                                updated[index].glue_board_replaced = 'yes';
                                setInsectMonitors(updated);
                              }}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={monitor.glue_board_replaced === 'no' || monitor.glue_board_replaced === 0}
                              onChange={() => {
                                const updated = [...insectMonitors];
                                updated[index].glue_board_replaced = 'no';
                                setInsectMonitors(updated);
                              }}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">No</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tubes Replaced
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={monitor.tubes_replaced === 'yes' || monitor.tubes_replaced === 1}
                              onChange={() => {
                                const updated = [...insectMonitors];
                                updated[index].tubes_replaced = 'yes';
                                setInsectMonitors(updated);
                              }}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={monitor.tubes_replaced === 'no' || monitor.tubes_replaced === 0}
                              onChange={() => {
                                const updated = [...insectMonitors];
                                updated[index].tubes_replaced = 'no';
                                setInsectMonitors(updated);
                              }}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">No</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Warning Sign Condition *
                        </label>
                        <select
                          value={monitor.warning_sign_condition}
                          onChange={(e) => {
                            const updated = [...insectMonitors];
                            updated[index].warning_sign_condition = e.target.value as any;
                            setInsectMonitors(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="good">Good</option>
                          <option value="replaced">Replaced</option>
                          <option value="repaired">Repaired</option>
                          <option value="remounted">Remounted</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Monitor Serviced *
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={monitor.monitor_serviced === 'yes' || monitor.monitor_serviced === 1}
                              onChange={() => {
                                const updated = [...insectMonitors];
                                updated[index].monitor_serviced = 'yes';
                                setInsectMonitors(updated);
                              }}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={monitor.monitor_serviced === 'no' || monitor.monitor_serviced === 0}
                              onChange={() => {
                                const updated = [...insectMonitors];
                                updated[index].monitor_serviced = 'no';
                                setInsectMonitors(updated);
                              }}
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">No</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
