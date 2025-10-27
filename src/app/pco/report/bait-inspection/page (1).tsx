'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReportLayout from '@/components/ReportLayout';
import StationForm from '@/components/StationForm';
import { API_CONFIG, apiCall } from '@/lib/api';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';

interface BaitStation {
  id: string; // Temporary ID for frontend
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
  isPrefilled?: boolean; // From previous report
}

interface Chemical {
  id: number;
  name: string;
  usage_type: string;
}

function BaitInspectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [expectedStations, setExpectedStations] = useState({ inside: 0, outside: 0 });
  
  const [activeLocation, setActiveLocation] = useState<'inside' | 'outside'>('inside');
  const [stations, setStations] = useState<BaitStation[]>([]);
  const [editingStation, setEditingStation] = useState<BaitStation | null>(null);
  const [showStationForm, setShowStationForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load report data from localStorage
      const savedReport = localStorage.getItem('current_report');
      if (!savedReport) {
        alert('Report data not found. Starting over.');
        router.push('/pco/schedule');
        return;
      }
      
      const report = JSON.parse(savedReport);
      setReportData(report);
      setClient(report.client);

      // Fetch chemicals for bait inspection (includes multi_purpose automatically)
      try {
        const chemicalsResponse = await apiCall('/api/pco/chemicals/bait_inspection');
        
        if (chemicalsResponse.success && Array.isArray(chemicalsResponse.data)) {
          setChemicals(chemicalsResponse.data);
        } else {
          setChemicals([]);
        }
      } catch (chemError) {
        console.error('Error fetching chemicals:', chemError);
        // Continue without chemicals - user can still create report
        setChemicals([]);
      }      // Get expected station count from client
      setExpectedStations({
        inside: report.client.bait_stations_inside || 0,
        outside: report.client.bait_stations_outside || 0
      });

      // Load any existing bait station data
      if (report.baitStations) {
        setStations(report.baitStations);
      }

      // TODO: Fetch previous report data for pre-filling
      // const previousReport = await apiCall(`/api/reports/last-for-client/${clientId}`);
      
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStation = () => {
    setEditingStation({
      id: Date.now().toString(),
      location: activeLocation,
      stationNumber: '',
      accessible: true,
      activityDetected: false,
      baitStatus: 'clean',
      stationCondition: 'good',
      warningSignCondition: 'good',
      chemicalsUsed: [],
    });
    setShowStationForm(true);
  };

  const handleEditStation = (station: BaitStation) => {
    setEditingStation({ ...station });
    setShowStationForm(true);
  };

  const handleDeleteStation = (stationId: string) => {
    if (confirm('Delete this station?')) {
      setStations(prev => prev.filter(s => s.id !== stationId));
    }
  };

  const handleSaveStation = (station: BaitStation) => {
    if (!station.stationNumber) {
      alert('Station number is required');
      return;
    }

    // Check for duplicate station number in same location
    const duplicate = stations.find(
      s => s.id !== station.id && 
      s.location === station.location && 
      s.stationNumber === station.stationNumber
    );
    
    if (duplicate) {
      alert(`Station #${station.stationNumber} already exists in ${station.location} location`);
      return;
    }

    setStations(prev => {
      const existing = prev.find(s => s.id === station.id);
      if (existing) {
        return prev.map(s => s.id === station.id ? station : s);
      } else {
        return [...prev, station];
      }
    });
    
    setShowStationForm(false);
    setEditingStation(null);
  };

  const handleContinue = () => {
    const insideStations = stations.filter(s => s.location === 'inside');
    const outsideStations = stations.filter(s => s.location === 'outside');

    // Warning if missing stations
    if (insideStations.length < expectedStations.inside || 
        outsideStations.length < expectedStations.outside) {
      const message = `Expected ${expectedStations.inside} inside and ${expectedStations.outside} outside stations.\n` +
                     `You have ${insideStations.length} inside and ${outsideStations.length} outside.\n\n` +
                     `Continue anyway?`;
      if (!confirm(message)) {
        return;
      }
    }

    // Save to report data
    const updatedReport = {
      ...reportData,
      baitStations: stations,
      step: reportData.reportType === 'both' ? 'fumigation' : 'summary'
    };
    localStorage.setItem('current_report', JSON.stringify(updatedReport));

    // Navigate to next screen
    if (reportData.reportType === 'both') {
      router.push(`/pco/report/fumigation?clientId=${clientId}`);
    } else {
      router.push(`/pco/report/summary?clientId=${clientId}`);
    }
  };

  const handleSaveDraft = () => {
    const updatedReport = {
      ...reportData,
      baitStations: stations,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('current_report', JSON.stringify(updatedReport));
    alert('Progress saved!');
  };

  if (loading) {
    return (
      <ReportLayout title="Bait Inspection">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ReportLayout>
    );
  }

  const insideStations = stations.filter(s => s.location === 'inside');
  const outsideStations = stations.filter(s => s.location === 'outside');

  return (
    <ReportLayout title="Bait Inspection">
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        {/* Client Info */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
          <h2 className="text-lg font-bold mb-1">Bait Station Inspection</h2>
          <p className="text-blue-100">{client?.company_name}</p>
        </div>

        {/* Location Tabs */}
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 flex gap-2">
          <button
            onClick={() => setActiveLocation('inside')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeLocation === 'inside'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Inside ({insideStations.length}/{expectedStations.inside})
          </button>
          <button
            onClick={() => setActiveLocation('outside')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeLocation === 'outside'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Outside ({outsideStations.length}/{expectedStations.outside})
          </button>
        </div>

        {/* Stations List */}
        <div className="space-y-3">
          {stations
            .filter(s => s.location === activeLocation)
            .sort((a, b) => parseInt(a.stationNumber) - parseInt(b.stationNumber))
            .map(station => (
              <div
                key={station.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">
                      Station #{station.stationNumber}
                      {station.isPrefilled && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          Pre-filled
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditStation(station)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteStation(station.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    {station.accessible ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-gray-600">
                      {station.accessible ? 'Accessible' : `Not accessible: ${station.accessReason}`}
                    </span>
                  </div>
                  
                  <div className="text-gray-600">
                    Bait: <span className="font-medium">{station.baitStatus}</span> • 
                    Condition: <span className="font-medium">{station.stationCondition}</span>
                  </div>
                  
                  {station.activityDetected && (
                    <div className="text-amber-700">
                      ⚠️ Activity: {station.activityTypes?.join(', ')}
                    </div>
                  )}
                  
                  {station.chemicalsUsed.length > 0 && (
                    <div className="text-gray-600">
                      Chemicals: {station.chemicalsUsed.map(c => c.chemicalName).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}

          {/* Add Station Button */}
          <button
            onClick={handleAddStation}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add {activeLocation.charAt(0).toUpperCase() + activeLocation.slice(1)} Station
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 sticky bottom-4">
          <button
            onClick={handleSaveDraft}
            className="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-colors active:scale-95"
          >
            Save Draft
          </button>
          <button
            onClick={handleContinue}
            disabled={stations.length === 0}
            className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Station Form Modal */}
      {showStationForm && editingStation && (
        <StationForm
          station={editingStation}
          chemicals={chemicals}
          onSave={handleSaveStation}
          onCancel={() => {
            setShowStationForm(false);
            setEditingStation(null);
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function BaitInspectionPage() {
  return (
    <Suspense fallback={
      <ReportLayout title="Bait Inspection">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ReportLayout>
    }>
      <BaitInspectionContent />
    </Suspense>
  );
}
