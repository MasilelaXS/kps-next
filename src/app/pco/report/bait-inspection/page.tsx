'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReportLayout from '@/components/ReportLayout';
import StationForm from '@/components/StationForm';
import Loading from '@/components/Loading';
import AlertModal from '@/components/AlertModal';
import { useAlert } from '@/hooks/useAlert';
import { apiCall } from '@/lib/api';
import { Plus, MapPin, AlertCircle } from 'lucide-react';

interface BaitStation {
  id: string;
  location: 'inside' | 'outside';
  stationNumber: string;
  accessible: boolean;
  accessReason?: string;
  activityDetected: boolean;
  activityTypes?: string[];
  activityOtherDesc?: string;
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
  isPrefilled?: boolean;
}

interface Chemical {
  id: number;
  name: string;
  usage_type: string;
}

function BaitInspectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alert = useAlert();
  const clientId = searchParams.get('clientId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [stations, setStations] = useState<BaitStation[]>([]);
  const [showStationForm, setShowStationForm] = useState(false);
  const [editingStation, setEditingStation] = useState<BaitStation | null>(null);
  const [previousStations, setPreviousStations] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Check authentication first
      const token = localStorage.getItem('kps_token');
      if (!token) {
        console.log('No authentication token found. Redirecting to login...');
        router.replace('/login');
        return;
      }

      // Load existing report data from localStorage
      const savedReport = localStorage.getItem('current_report');
      if (!savedReport) {
        setError('No report data found. Please start from the beginning.');
        setLoading(false);
        return;
      }

      const reportData = JSON.parse(savedReport);
      setReport(reportData);
      setClient(reportData.client);

      // Load previously saved stations if any
      if (reportData.baitStations && Array.isArray(reportData.baitStations)) {
        // Check if data is in DB format (has station_number) and needs transformation
        const firstStation = reportData.baitStations[0];
        if (firstStation && 'station_number' in firstStation) {
          // Transform from DB format to frontend format
          const transformedStations = reportData.baitStations.map((dbStation: any) => ({
            id: dbStation.id,
            stationNumber: dbStation.station_number,
            location: dbStation.location,
            accessible: dbStation.is_accessible,
            accessReason: dbStation.inaccessible_reason || undefined,
            activityDetected: dbStation.activity_detected,
            activityTypes: [
              dbStation.activity_droppings && 'droppings',
              dbStation.activity_gnawing && 'gnawing',
              dbStation.activity_tracks && 'tracks',
              dbStation.activity_other && 'other'
            ].filter(Boolean),
            activityOtherDesc: dbStation.activity_other_description || undefined,
            baitStatus: dbStation.bait_status,
            stationCondition: dbStation.station_condition,
            actionTaken: dbStation.action_taken || 'none',
            warningSignCondition: dbStation.warning_sign_condition || 'good',
            rodentBoxReplaced: dbStation.rodent_box_replaced || false,
            remarks: dbStation.station_remarks || undefined,
            chemicals: (dbStation.chemicals || []).map((chem: any) => ({
              chemicalId: chem.chemical_id,
              chemicalName: chem.chemical_name,
              quantity: chem.quantity,
              batchNumber: chem.batch_number
            }))
          }));
          setStations(transformedStations);
        } else {
          // Already in frontend format
          setStations(reportData.baitStations);
        }
      } else if (reportData.existingData?.baitStations && Array.isArray(reportData.existingData.baitStations)) {
        // Load from existing report data (edit mode) and transform from DB format to frontend format
        const transformedStations = reportData.existingData.baitStations.map((dbStation: any) => ({
          id: dbStation.id,
          stationNumber: dbStation.station_number,
          location: dbStation.location,
          accessible: dbStation.is_accessible,
          accessReason: dbStation.inaccessible_reason || undefined,
          activityDetected: dbStation.activity_detected,
          activityTypes: [
            dbStation.activity_droppings && 'droppings',
            dbStation.activity_gnawing && 'gnawing',
            dbStation.activity_tracks && 'tracks',
            dbStation.activity_other && 'other'
          ].filter(Boolean),
          activityOtherDesc: dbStation.activity_other_description || undefined,
          baitStatus: dbStation.bait_status,
          stationCondition: dbStation.station_condition,
          actionTaken: dbStation.action_taken || 'none',
          warningSignCondition: dbStation.warning_sign_condition || 'good',
          rodentBoxReplaced: dbStation.rodent_box_replaced || false,
          remarks: dbStation.station_remarks || undefined,
          chemicals: (dbStation.chemicals || []).map((chem: any) => ({
            chemicalId: chem.chemical_id,
            chemicalName: chem.chemical_name,
            quantity: chem.quantity,
            batchNumber: chem.batch_number
          }))
        }));
        setStations(transformedStations);
      }

      // Fetch chemicals
      const chemicalsResponse = await apiCall('/api/pco/sync/chemicals');
      if (chemicalsResponse.success && Array.isArray(chemicalsResponse.data)) {
        setChemicals(chemicalsResponse.data);
      }

      // Fetch previous report data for pre-filling (only if not in edit mode)
      if (reportData.clientId && !reportData.isEditMode) {
        try {
          const previousReportResponse = await apiCall(`/api/pco/reports/last-for-client/${reportData.clientId}`);
          if (previousReportResponse.success && previousReportResponse.data?.bait_stations) {
            setPreviousStations(previousReportResponse.data.bait_stations);
          }
        } catch (err) {
          console.log('No previous report data available or offline');
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading data:', error);
      
      // Check if it's an authentication error
      if (error.message?.includes('Session expired') || error.message?.includes('login')) {
        router.replace('/login');
        return;
      }
      
      setError(error.message || 'Failed to load data');
      setLoading(false);
    }
  };

  const mapPreviousStationToForm = (prevStation: any, currentStation: BaitStation): BaitStation => {
    // Map previous station data to form format, excluding chemicals for fresh batch numbers
    return {
      ...currentStation,
      accessible: prevStation.is_accessible,
      accessReason: prevStation.inaccessible_reason || undefined,
      activityDetected: prevStation.activity_detected,
      activityTypes: [
        prevStation.activity_droppings && 'droppings',
        prevStation.activity_gnawing && 'gnawing',
        prevStation.activity_tracks && 'tracks',
        prevStation.activity_other && 'other'
      ].filter(Boolean) as string[],
      baitStatus: prevStation.bait_status || 'clean',
      stationCondition: prevStation.station_condition || 'good',
      warningSignCondition: prevStation.warning_sign_condition || 'good',
      remarks: prevStation.station_remarks || undefined,
      isPrefilled: true,
      // Keep chemicals empty so PCO enters fresh batch numbers
      chemicalsUsed: currentStation.chemicalsUsed
    };
  };

  const saveStationToList = (station: BaitStation) => {
    setStations(prev => {
      const existing = prev.find(s => s.id === station.id);
      if (existing) {
        return prev.map(s => s.id === station.id ? station : s);
      }
      return [...prev, station];
    });
    setShowStationForm(false);
    setEditingStation(null);
  };

  const handleSaveStation = (station: BaitStation) => {
    if (!station.stationNumber) {
      alert.showWarning('Station number is required', 'Missing Information');
      return;
    }

    // Check for duplicate station number in same location
    const duplicate = stations.find(
      s => s.id !== station.id && 
      s.location === station.location && 
      s.stationNumber === station.stationNumber
    );
    
    if (duplicate) {
      alert.showWarning(`Station ${station.stationNumber} already exists in ${station.location}`, 'Duplicate Station');
      return;
    }

    // Check if this matches a previous report station and it wasn't already pre-filled
    const matchingPrevious = previousStations.find(
      (prev: any) => prev.location === station.location && prev.station_number === station.stationNumber
    );

    // If we found matching previous data and this is a new station (not editing), offer to pre-fill
    if (matchingPrevious && !station.isPrefilled && !stations.find(s => s.id === station.id)) {
      alert.showConfirm(
        `Found previous data for ${station.location} station #${station.stationNumber}.\n\nWould you like to pre-fill this station with data from the last report?`,
        () => {
          // Pre-fill station with previous data
          const prefilledStation = mapPreviousStationToForm(matchingPrevious, station);
          saveStationToList(prefilledStation);
        },
        'Pre-fill Station Data?',
        'info',
        () => {
          // User declined pre-fill, save as-is
          saveStationToList(station);
        }
      );
      return;
    }

    // No previous data or user already made a choice, save normally
    saveStationToList(station);
  };

  const handleAddStation = (location: 'inside' | 'outside') => {
    const newStation: BaitStation = {
      id: Date.now().toString(),
      location,
      stationNumber: '',
      accessible: true,
      activityDetected: false,
      baitStatus: 'clean',
      stationCondition: 'good',
      warningSignCondition: 'good',
      chemicalsUsed: [],
    };
    setEditingStation(newStation);
    setShowStationForm(true);
  };

  const handleEditStation = (station: BaitStation) => {
    setEditingStation(station);
    setShowStationForm(true);
  };

  const handleDeleteStation = (stationId: string) => {
    alert.showConfirm(
      'Are you sure you want to delete this station?',
      () => {
        setStations(prev => prev.filter(s => s.id !== stationId));
      },
      'Delete Station',
      'warning'
    );
  };

  const checkForMissingStations = () => {
    const insideStations = stations.filter(s => s.location === 'inside');
    const outsideStations = stations.filter(s => s.location === 'outside');

    const expectedInside = client?.total_bait_stations_inside || 0;
    const expectedOutside = client?.total_bait_stations_outside || 0;

    const missingInside = expectedInside - insideStations.length;
    const missingOutside = expectedOutside - outsideStations.length;

    if (missingInside > 0 || missingOutside > 0) {
      let message = 'Expected stations:\n';
      if (missingInside > 0) {
        message += `\n• ${missingInside} Inside stations missing`;
      }
      if (missingOutside > 0) {
        message += `\n• ${missingOutside} Outside stations missing`;
      }
      message += '\n\nDo you want to continue anyway?';

      alert.showConfirm(
        message,
        () => proceedToNextStep(),
        'Missing Stations',
        'warning'
      );
      return false;
    }
    return true;
  };

  const updateClientStationCounts = async (insideCount: number, outsideCount: number) => {
    try {
      console.log('=== UPDATING CLIENT STATION COUNTS (LOCAL ONLY) ===');
      console.log('Expected inside:', client?.total_bait_stations_inside, '→ New:', insideCount);
      console.log('Expected outside:', client?.total_bait_stations_outside, '→ New:', outsideCount);

      // Store old expected counts for missing check
      const oldExpectedInside = client?.total_bait_stations_inside || 0;
      const oldExpectedOutside = client?.total_bait_stations_outside || 0;

      // Update local state
      setClient((prev: any) => ({
        ...prev,
        total_bait_stations_inside: insideCount,
        total_bait_stations_outside: outsideCount
      }));

      // Update localStorage
      const savedReport = localStorage.getItem('current_report');
      if (savedReport) {
        const reportData = JSON.parse(savedReport);
        reportData.client.total_bait_stations_inside = insideCount;
        reportData.client.total_bait_stations_outside = outsideCount;
        localStorage.setItem('current_report', JSON.stringify(reportData));
        console.log('Updated localStorage with new counts');
      }

      // Don't show success alert here - it conflicts with missing stations check
      
      console.log('Checking for missing stations using OLD expected counts...');
      // Check for missing stations using OLD expected counts (before update)
      const insideStations = stations.filter(s => s.location === 'inside');
      const outsideStations = stations.filter(s => s.location === 'outside');
      
      console.log('Inside stations:', insideStations.length, 'Expected (old):', oldExpectedInside);
      console.log('Outside stations:', outsideStations.length, 'Expected (old):', oldExpectedOutside);
      
      const missingInside = oldExpectedInside - insideStations.length;
      const missingOutside = oldExpectedOutside - outsideStations.length;

      console.log('Missing inside:', missingInside, 'Missing outside:', missingOutside);

      if (missingInside > 0 || missingOutside > 0) {
        let message = 'Expected stations:\n';
        if (missingInside > 0) {
          message += `\n• ${missingInside} Inside stations missing`;
        }
        if (missingOutside > 0) {
          message += `\n• ${missingOutside} Outside stations missing`;
        }
        message += '\n\nDo you want to continue anyway?';

        console.log('Showing missing stations confirmation...');
        
        // Small delay to let the first alert fully close
        setTimeout(() => {
          alert.showConfirm(
            message,
            () => {
              console.log('Missing stations confirmed - proceeding to next step');
              proceedToNextStep();
            },
            'Missing Stations',
            'warning'
          );
        }, 100);
        return;
      }
      
      console.log('No missing stations - proceeding to next step...');
      proceedToNextStep();
    } catch (error) {
      console.error('=== ERROR IN updateClientStationCounts ===');
      console.error('Error details:', error);
      alert.showError('Failed to update station counts. Check console for details.');
    }
  };

  const handleContinue = () => {
    if (stations.length === 0) {
      alert.showWarning('Please add at least one station', 'No Stations');
      return;
    }

    const insideStations = stations.filter(s => s.location === 'inside');
    const outsideStations = stations.filter(s => s.location === 'outside');

    const expectedInside = client?.total_bait_stations_inside || 0;
    const expectedOutside = client?.total_bait_stations_outside || 0;

    // Check for EXCESS stations first
    if (insideStations.length > expectedInside || outsideStations.length > expectedOutside) {
      let message = 'You have added more stations than expected:\n';
      if (insideStations.length > expectedInside) {
        message += `\n• Inside: ${insideStations.length} (expected ${expectedInside})`;
      }
      if (outsideStations.length > expectedOutside) {
        message += `\n• Outside: ${outsideStations.length} (expected ${expectedOutside})`;
      }
      message += '\n\nWould you like to update the client\'s station count?';

      alert.showConfirm(
        message,
        () => updateClientStationCounts(insideStations.length, outsideStations.length),
        'Update Client Station Count?',
        'info',
        () => {
          // User declined to update, check for missing
          if (!checkForMissingStations()) {
            return;
          }
          proceedToNextStep();
        }
      );
      return;
    }

    // Check for missing stations
    if (!checkForMissingStations()) {
      return;
    }

    // Continue to next step
    proceedToNextStep();
  };

  const proceedToNextStep = () => {
    // Save stations to localStorage
    const updatedReport = {
      ...report,
      baitStations: stations,
      step: 'summary',
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('current_report', JSON.stringify(updatedReport));

    // Navigate based on report type
    if (report.reportType === 'both') {
      router.push('/pco/report/fumigation');
    } else {
      router.push('/pco/report/summary');
    }
  };

  if (loading) {
    return (
      <ReportLayout currentStep={2} totalSteps={5} title="Bait Inspection">
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      </ReportLayout>
    );
  }

  if (error) {
    return (
      <ReportLayout currentStep={2} totalSteps={5} title="Bait Inspection">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout currentStep={2} totalSteps={5} title="Bait Station Inspection">
      <div className="space-y-6">
        {/* Expected Counts */}
        {client && (client.total_bait_stations_inside > 0 || client.total_bait_stations_outside > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Expected Stations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700">Inside</p>
                <p className="text-2xl font-bold text-blue-900">{client.total_bait_stations_inside}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Outside</p>
                <p className="text-2xl font-bold text-blue-900">{client.total_bait_stations_outside}</p>
              </div>
            </div>
          </div>
        )}

        {/* Inside Stations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Inside Stations ({stations.filter(s => s.location === 'inside').length})
            </h2>
            <button
              onClick={() => handleAddStation('inside')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="space-y-2">
            {stations
              .filter(s => s.location === 'inside')
              .map(station => (
                <div key={station.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Station #{station.stationNumber}</p>
                    <p className="text-sm text-gray-500">
                      {station.activityDetected && '⚠️ Activity • '}
                      Condition: {station.stationCondition}
                      {station.isPrefilled && ' • 🔄 Pre-filled'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditStation(station)}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteStation(station.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            {stations.filter(s => s.location === 'inside').length === 0 && (
              <p className="text-center text-gray-500 py-8">No inside stations added yet</p>
            )}
          </div>
        </div>

        {/* Outside Stations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Outside Stations ({stations.filter(s => s.location === 'outside').length})
            </h2>
            <button
              onClick={() => handleAddStation('outside')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="space-y-2">
            {stations
              .filter(s => s.location === 'outside')
              .map(station => (
                <div key={station.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Station #{station.stationNumber}</p>
                    <p className="text-sm text-gray-500">
                      {station.activityDetected && '⚠️ Activity • '}
                      Condition: {station.stationCondition}
                      {station.isPrefilled && ' • 🔄 Pre-filled'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditStation(station)}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteStation(station.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            {stations.filter(s => s.location === 'outside').length === 0 && (
              <p className="text-center text-gray-500 py-8">No outside stations added yet</p>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={stations.length === 0}
          className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>

      {/* Station Form Modal */}
      {showStationForm && editingStation && (
        <StationForm
          station={editingStation}
          chemicals={chemicals}
          previousStations={previousStations}
          onSave={handleSaveStation}
          onCancel={() => {
            setShowStationForm(false);
            setEditingStation(null);
          }}
        />
      )}

      <AlertModal
        isOpen={alert.isOpen}
        {...alert.config}
        onClose={alert.hideAlert}
      />
    </ReportLayout>
  );
}

export default function BaitInspectionPage() {
  return (
    <Suspense fallback={
      <ReportLayout currentStep={2} totalSteps={5} title="Bait Inspection">
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      </ReportLayout>
    }>
      <BaitInspectionContent />
    </Suspense>
  );
}
