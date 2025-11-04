'use client';

import { useState } from 'react';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  X,
  Save
} from 'lucide-react';
import TextBox from '@/components/TextBox';
import TextArea from '@/components/TextArea';
import AlertModal from '@/components/AlertModal';
import { useAlert } from '@/hooks/useAlert';

// Import types from parent
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
  station_number: number;
  accessible: 'yes' | 'no';
  not_accessible_reason?: string;
  activity_detected: 'yes' | 'no';
  activity_droppings?: boolean;
  activity_gnawing?: boolean;
  activity_tracks?: boolean;
  activity_other?: string;
  bait_status: 'clean' | 'eaten' | 'wet' | 'old';
  station_condition: 'good' | 'needs_repair' | 'damaged' | 'missing';
  action_taken?: 'repaired' | 'replaced';
  warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted';
  station_remarks?: string;
  chemicals: Chemical[];
}

interface FumigationArea {
  id?: number;
  report_id?: number;
  area_name: string;
}

interface FumigationTargetPest {
  id?: number;
  report_id?: number;
  pest_name: string;
}

interface FumigationChemical {
  id?: number;
  report_id?: number;
  chemical_id: number;
  chemical_name?: string;
  quantity: number;
  unit: string;
  batch_number: string;
}

interface InsectMonitor {
  id?: number;
  report_id?: number;
  monitor_type: 'box' | 'light_fly_trap';
  monitor_condition: 'good' | 'replaced' | 'repaired' | 'other';
  monitor_condition_other?: string;
  light_condition?: 'good' | 'faulty';
  light_faulty_reason?: 'starter' | 'tube' | 'cable' | 'electricity' | 'other';
  light_faulty_other?: string;
  glue_board_replaced?: 'yes' | 'no';
  tubes_replaced?: 'yes' | 'no';
  warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted';
  monitor_serviced: 'yes' | 'no';
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
  general_remarks?: string;
  recommendations?: string;
  admin_notes?: string;
  bait_stations?: BaitStation[];
  fumigation?: {
    areas: FumigationArea[];
    target_pests: FumigationTargetPest[];
    chemicals: FumigationChemical[];
  };
  insect_monitors?: InsectMonitor[];
}

interface EditReportModalProps {
  report: Report;
  availableChemicals: any[];
  onSave: (updatedReport: Report) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

const AVAILABLE_AREAS = [
  'Kitchen', 'Storage Room', 'Loading Dock', 'Dining Area',
  'Prep Area', 'Main Kitchen', 'Dining Hall', 'Bathroom',
  'Office', 'Warehouse'
];

const AVAILABLE_PESTS = [
  'Cockroaches', 'Ants', 'Flies', 'Moths', 'Spiders',
  'Beetles', 'Termites'
];

export default function EditReportModal({
  report,
  availableChemicals,
  onSave,
  onCancel,
  submitting
}: EditReportModalProps) {
  const alert = useAlert();
  const [editedReport, setEditedReport] = useState<Report>(JSON.parse(JSON.stringify(report)));
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [editingMonitorId, setEditingMonitorId] = useState<number | null>(null);

  // Bait Station Functions
  const addBaitStation = (location: 'inside' | 'outside') => {
    const newStation: BaitStation = {
      location,
      station_number: (editedReport.bait_stations?.filter(s => s.location === location).length || 0) + 1,
      accessible: 'yes',
      activity_detected: 'no',
      bait_status: 'clean',
      station_condition: 'good',
      warning_sign_condition: 'good',
      chemicals: []
    };

    setEditedReport({
      ...editedReport,
      bait_stations: [...(editedReport.bait_stations || []), newStation]
    });
  };

  const updateBaitStation = (index: number, updates: Partial<BaitStation>) => {
    const newStations = [...(editedReport.bait_stations || [])];
    newStations[index] = { ...newStations[index], ...updates };
    setEditedReport({ ...editedReport, bait_stations: newStations });
  };

  const deleteBaitStation = (index: number) => {
    alert.showConfirm(
      'Are you sure you want to delete this station?',
      () => {
        const newStations = editedReport.bait_stations?.filter((_, i) => i !== index) || [];
        setEditedReport({ ...editedReport, bait_stations: newStations });
      },
      'Delete Station',
      'warning'
    );
  };

  const addChemicalToStation = (stationIndex: number) => {
    const newChemical: Chemical = {
      chemical_id: 0,
      quantity: 0,
      batch_number: ''
    };
    
    const newStations = [...(editedReport.bait_stations || [])];
    newStations[stationIndex].chemicals = [...newStations[stationIndex].chemicals, newChemical];
    setEditedReport({ ...editedReport, bait_stations: newStations });
  };

  const updateStationChemical = (stationIndex: number, chemIndex: number, updates: Partial<Chemical>) => {
    const newStations = [...(editedReport.bait_stations || [])];
    newStations[stationIndex].chemicals[chemIndex] = {
      ...newStations[stationIndex].chemicals[chemIndex],
      ...updates
    };
    setEditedReport({ ...editedReport, bait_stations: newStations });
  };

  const deleteStationChemical = (stationIndex: number, chemIndex: number) => {
    const newStations = [...(editedReport.bait_stations || [])];
    newStations[stationIndex].chemicals = newStations[stationIndex].chemicals.filter((_, i) => i !== chemIndex);
    setEditedReport({ ...editedReport, bait_stations: newStations });
  };

  // Fumigation Functions
  const toggleFumigationArea = (areaName: string) => {
    const currentAreas = editedReport.fumigation?.areas || [];
    const exists = currentAreas.find(a => a.area_name === areaName);

    if (exists) {
      setEditedReport({
        ...editedReport,
        fumigation: {
          ...editedReport.fumigation!,
          areas: currentAreas.filter(a => a.area_name !== areaName)
        }
      });
    } else {
      setEditedReport({
        ...editedReport,
        fumigation: {
          ...editedReport.fumigation!,
          areas: [...currentAreas, { area_name: areaName }]
        }
      });
    }
  };

  const toggleTargetPest = (pestName: string) => {
    const currentPests = editedReport.fumigation?.target_pests || [];
    const exists = currentPests.find(p => p.pest_name === pestName);

    if (exists) {
      setEditedReport({
        ...editedReport,
        fumigation: {
          ...editedReport.fumigation!,
          target_pests: currentPests.filter(p => p.pest_name !== pestName)
        }
      });
    } else {
      setEditedReport({
        ...editedReport,
        fumigation: {
          ...editedReport.fumigation!,
          target_pests: [...currentPests, { pest_name: pestName }]
        }
      });
    }
  };

  const addFumigationChemical = () => {
    const newChemical: FumigationChemical = {
      chemical_id: 0,
      quantity: 0,
      unit: 'ml',
      batch_number: ''
    };

    setEditedReport({
      ...editedReport,
      fumigation: {
        ...editedReport.fumigation!,
        chemicals: [...(editedReport.fumigation?.chemicals || []), newChemical]
      }
    });
  };

  const updateFumigationChemical = (index: number, updates: Partial<FumigationChemical>) => {
    const newChemicals = [...(editedReport.fumigation?.chemicals || [])];
    newChemicals[index] = { ...newChemicals[index], ...updates };
    setEditedReport({
      ...editedReport,
      fumigation: {
        ...editedReport.fumigation!,
        chemicals: newChemicals
      }
    });
  };

  const deleteFumigationChemical = (index: number) => {
    const newChemicals = editedReport.fumigation?.chemicals.filter((_, i) => i !== index) || [];
    setEditedReport({
      ...editedReport,
      fumigation: {
        ...editedReport.fumigation!,
        chemicals: newChemicals
      }
    });
  };

  // Insect Monitor Functions
  const addInsectMonitor = () => {
    const newMonitor: InsectMonitor = {
      monitor_type: 'box',
      monitor_condition: 'good',
      warning_sign_condition: 'good',
      monitor_serviced: 'yes'
    };

    setEditedReport({
      ...editedReport,
      insect_monitors: [...(editedReport.insect_monitors || []), newMonitor]
    });
  };

  const updateInsectMonitor = (index: number, updates: Partial<InsectMonitor>) => {
    const newMonitors = [...(editedReport.insect_monitors || [])];
    newMonitors[index] = { ...newMonitors[index], ...updates };
    setEditedReport({ ...editedReport, insect_monitors: newMonitors });
  };

  const deleteInsectMonitor = (index: number) => {
    alert.showConfirm(
      'Are you sure you want to delete this monitor?',
      () => {
        const newMonitors = editedReport.insect_monitors?.filter((_, i) => i !== index) || [];
        setEditedReport({ ...editedReport, insect_monitors: newMonitors });
      },
      'Delete Monitor',
      'warning'
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 z-20 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Edit Report #{editedReport.id}</h2>
              <p className="text-sm text-white/80">{editedReport.company_name || editedReport.client_name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-white/80 hover:text-white text-2xl font-light"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          
          {/* Basic Info - Read-only display */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-5 border-2 border-blue-200">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Report Information (Read-Only)</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Report ID</p>
                <p className="font-medium text-gray-900">#{editedReport.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Client</p>
                <p className="font-medium text-gray-900">{editedReport.company_name || editedReport.client_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">PCO</p>
                <p className="font-medium text-gray-900">{editedReport.pco_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Current Status</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  editedReport.status === 'approved' ? 'bg-green-100 text-green-700' :
                  editedReport.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  editedReport.status === 'archived' ? 'bg-gray-100 text-gray-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {editedReport.status}
                </span>
              </div>
            </div>
          </div>

          {/* Report Type & Service Dates */}
          <div className="bg-white border-2 border-purple-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type
                </label>
                <select
                  value={editedReport.report_type}
                  onChange={(e) => setEditedReport({ ...editedReport, report_type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                >
                  <option value="bait_inspection">Bait Inspection</option>
                  <option value="fumigation">Fumigation</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <TextBox
                label="Service Date"
                type="date"
                value={editedReport.service_date?.split('T')[0] || ''}
                onChange={(e) => setEditedReport({ ...editedReport, service_date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                helperText="Cannot be in the future"
              />
              <TextBox
                label="Next Service Date"
                type="date"
                value={editedReport.next_service_date?.split('T')[0] || ''}
                onChange={(e) => setEditedReport({ ...editedReport, next_service_date: e.target.value })}
                min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                helperText="Must be a future date"
              />
            </div>
          </div>

          {/* Admin Notes & Recommendations */}
          <div className="bg-white border-2 border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Fields</h3>
            <div className="space-y-4">
              <TextArea
                label="Admin Recommendations (Admin Only)"
                value={editedReport.recommendations || ''}
                onChange={(e) => setEditedReport({ ...editedReport, recommendations: e.target.value })}
                rows={3}
                placeholder="Add professional recommendations for the client..."
              />
              <TextArea
                label="Admin Notes (Internal)"
                value={editedReport.admin_notes || ''}
                onChange={(e) => setEditedReport({ ...editedReport, admin_notes: e.target.value })}
                rows={2}
                placeholder="Internal notes for admin team..."
              />
              <div className="bg-gray-100 p-3 rounded-lg">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  PCO Remarks (Read-Only - Cannot Edit)
                </label>
                <p className="text-sm text-gray-700 italic">
                  {editedReport.general_remarks || 'No remarks provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Continue with Bait Stations, Fumigation, and Monitors sections... */}
          {/* This file is getting large - will continue in next message */}
          
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl sticky bottom-0">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editedReport)}
            disabled={submitting}
            className="px-6 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save All Changes
              </>
            )}
          </button>
        </div>
      </div>

      <AlertModal
        isOpen={alert.isOpen}
        {...alert.config}
        onClose={alert.hideAlert}
      />
    </div>
  );
}
