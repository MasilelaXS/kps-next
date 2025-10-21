'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReportLayout from '@/components/ReportLayout';
import TextBox from '@/components/TextBox';
import TextArea from '@/components/TextArea';
import AlertModal from '@/components/AlertModal';
import { useAlert } from '@/hooks/useAlert';
import { API_CONFIG, apiCall } from '@/lib/api';
import { Plus, X, AlertCircle } from 'lucide-react';

interface Chemical {
  id: number;
  name: string;
  usage_type: string;
}

interface ChemicalUsed {
  chemicalId: number;
  chemicalName: string;
  quantity: number;
  batchNumber: string;
}

interface InsectMonitor {
  id: string;
  type: 'box' | 'light';
  location: string;
  monitorNumber: string;
  condition: 'good' | 'needs_repair' | 'damaged' | 'missing' | 'other';
  conditionOther?: string; // Description when condition is 'other'
  actionTaken?: 'repaired' | 'replaced';
  warningSignCondition: 'good' | 'replaced' | 'repaired' | 'remounted';
  // Light trap specific
  lightCondition?: 'good' | 'faulty';
  lightFaultyType?: 'starter' | 'tube' | 'cable' | 'electricity' | 'other';
  lightFaultyOther?: string; // Description when lightFaultyType is 'other'
  glueBoard?: 'good' | 'replaced';
  tubesCondition?: 'good' | 'replaced';
  remarks?: string;
}

function FumigationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const alert = useAlert();

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [expectedMonitors, setExpectedMonitors] = useState({ light: 0, box: 0 });

  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedPests, setSelectedPests] = useState<string[]>([]);
  const [otherAreaDescription, setOtherAreaDescription] = useState('');
  const [otherPestDescription, setOtherPestDescription] = useState('');
  const [chemicalsUsed, setChemicalsUsed] = useState<ChemicalUsed[]>([]);
  const [monitors, setMonitors] = useState<InsectMonitor[]>([]);

  const [showChemicalPicker, setShowChemicalPicker] = useState(false);
  const [showMonitorForm, setShowMonitorForm] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<InsectMonitor | null>(null);

  const areasOptions = [
    'Kitchen', 'Dining Area', 'Storage', 'Warehouse', 'Office', 
    'Restrooms', 'Production Area', 'Loading Dock', 'Perimeter', 'Other'
  ];

  const pestOptions = [
    'Cockroaches', 'Ants', 'Flies', 'Mosquitoes', 'Rodents', 
    'Termites', 'Bed Bugs', 'Stored Product Pests', 'Other'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load report data from localStorage
      const savedReport = localStorage.getItem('current_report');
      if (!savedReport) {
        alert.showError('Report data not found. Starting over.');
        router.push('/pco/schedule');
        return;
      }
      
      const report = JSON.parse(savedReport);
      setReportData(report);
      setClient(report.client);

      // Fetch chemicals for fumigation (includes multi_purpose automatically)
      try {
        const chemicalsResponse = await apiCall('/api/pco/chemicals/fumigation');
        
        if (chemicalsResponse.success && Array.isArray(chemicalsResponse.data)) {
          setChemicals(chemicalsResponse.data);
        } else {
          setChemicals([]);
        }
      } catch (chemError) {
        console.error('Error fetching chemicals:', chemError);
        // Continue without chemicals - user can still create report
        setChemicals([]);
      }

      // Get expected monitor count from client
      setExpectedMonitors({
        light: report.client.total_insect_monitors_light || 0,
        box: report.client.total_insect_monitors_box || 0
      });

      // Load any existing fumigation data
      if (report.fumigation) {
        setSelectedAreas(report.fumigation.areas || []);
        setSelectedPests(report.fumigation.pests || []);
        setChemicalsUsed(report.fumigation.chemicals || []);
        setMonitors(report.fumigation.monitors || []);
        setOtherAreaDescription(report.fumigation.otherAreaDescription || '');
        setOtherPestDescription(report.fumigation.otherPestDescription || '');
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      alert.showError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleTogglePest = (pest: string) => {
    setSelectedPests(prev =>
      prev.includes(pest) ? prev.filter(p => p !== pest) : [...prev, pest]
    );
  };

  const handleAddChemical = (chemical: Chemical) => {
    const newChemical: ChemicalUsed = {
      chemicalId: chemical.id,
      chemicalName: chemical.name,
      quantity: 0,
      batchNumber: '',
    };
    setChemicalsUsed([...chemicalsUsed, newChemical]);
    setShowChemicalPicker(false);
  };

  const handleUpdateChemical = (index: number, field: 'quantity' | 'batchNumber', value: string | number) => {
    const updated = [...chemicalsUsed];
    updated[index] = { ...updated[index], [field]: value };
    setChemicalsUsed(updated);
  };

  const handleRemoveChemical = (index: number) => {
    setChemicalsUsed(chemicalsUsed.filter((_, i) => i !== index));
  };

  const handleAddMonitor = (type: 'box' | 'light') => {
    setEditingMonitor({
      id: Date.now().toString(),
      type,
      location: '',
      monitorNumber: '',
      condition: 'good',
      warningSignCondition: 'good',
    });
    setShowMonitorForm(true);
  };

  const handleSaveMonitor = (monitor: InsectMonitor) => {
    if (!monitor.monitorNumber || !monitor.location) {
      alert.showWarning('Monitor number and location are required', 'Missing Information');
      return;
    }

    setMonitors(prev => {
      const existing = prev.find(m => m.id === monitor.id);
      if (existing) {
        return prev.map(m => m.id === monitor.id ? monitor : m);
      } else {
        return [...prev, monitor];
      }
    });
    
    setShowMonitorForm(false);
    setEditingMonitor(null);
  };

  const handleDeleteMonitor = (monitorId: string) => {
    alert.showConfirm('Are you sure you want to delete this monitor?', () => {
      setMonitors(prev => prev.filter(m => m.id !== monitorId));
    }, 'Delete Monitor');
  };

  const handleSaveDraft = () => {
    const updatedReport = {
      ...reportData,
      fumigation: {
        areas: selectedAreas,
        otherAreaDescription,
        pests: selectedPests,
        otherPestDescription,
        chemicals: chemicalsUsed,
        monitors,
      },
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('current_report', JSON.stringify(updatedReport));
    alert.showSuccess('Progress saved!');
  };

  const handleContinue = () => {
    // Validation
    if (selectedAreas.length === 0) {
      alert.showWarning('Please select at least one area treated', 'Validation Error');
      return;
    }

    if (selectedAreas.includes('Other') && !otherAreaDescription.trim()) {
      alert.showWarning('Please specify the other area', 'Validation Error');
      return;
    }

    if (selectedPests.length === 0) {
      alert.showWarning('Please select at least one target pest', 'Validation Error');
      return;
    }

    if (selectedPests.includes('Other') && !otherPestDescription.trim()) {
      alert.showWarning('Please specify the other pest', 'Validation Error');
      return;
    }

    if (chemicalsUsed.length === 0) {
      alert.showWarning('Please add at least one chemical used', 'Validation Error');
      return;
    }

    // Validate chemicals
    for (const chem of chemicalsUsed) {
      if (!chem.quantity || chem.quantity <= 0) {
        alert.showWarning(`Please enter quantity for ${chem.chemicalName}`, 'Validation Error');
        return;
      }
      if (!chem.batchNumber) {
        alert.showWarning(`Please enter batch number for ${chem.chemicalName}`, 'Validation Error');
        return;
      }
    }

    // Check monitor count against expected
    const lightMonitors = monitors.filter(m => m.type === 'light');
    const boxMonitors = monitors.filter(m => m.type === 'box');

    // Check if more monitors than expected
    if (lightMonitors.length > expectedMonitors.light || 
        boxMonitors.length > expectedMonitors.box) {
      const message = `You have added more monitors than expected:\n` +
                     `Light: ${lightMonitors.length} (expected ${expectedMonitors.light})\n` +
                     `Box: ${boxMonitors.length} (expected ${expectedMonitors.box})\n\n` +
                     `Would you like to update the client's monitor count to reflect the actual numbers?`;
      alert.showConfirm(message, () => {
        updateClientMonitorCounts(lightMonitors.length, boxMonitors.length);
      }, 'Update Client Monitor Count?', 'info', () => {
        // If they decline to update, check for missing monitors
        checkForMissingMonitors();
      });
      return;
    }

    // Check for missing monitors
    checkForMissingMonitors();
  };

  const checkForMissingMonitors = () => {
    const lightMonitors = monitors.filter(m => m.type === 'light');
    const boxMonitors = monitors.filter(m => m.type === 'box');

    if (lightMonitors.length < expectedMonitors.light || 
        boxMonitors.length < expectedMonitors.box) {
      const message = `Expected ${expectedMonitors.light} light and ${expectedMonitors.box} box monitors.\n` +
                     `You have ${lightMonitors.length} light and ${boxMonitors.length} box monitors.\n\n` +
                     `Continue anyway?`;
      alert.showConfirm(message, () => {
        proceedToSummary();
      }, 'Monitor Count Mismatch', 'warning');
      return;
    }

    proceedToSummary();
  };

  const updateClientMonitorCounts = async (lightCount: number, boxCount: number) => {
    try {
      const response = await apiCall(`/api/pco/clients/${client.id}/update-counts`, {
        method: 'PATCH',
        body: JSON.stringify({
          total_insect_monitors_light: lightCount,
          total_insect_monitors_box: boxCount
        })
      });

      if (response.success) {
        // Update local state
        setExpectedMonitors({
          light: lightCount,
          box: boxCount
        });
        
        // Update report data with new counts
        const updatedReport = {
          ...reportData,
          client: {
            ...reportData.client,
            total_insect_monitors_light: lightCount,
            total_insect_monitors_box: boxCount
          }
        };
        localStorage.setItem('current_report', JSON.stringify(updatedReport));
        
        alert.showSuccess('Client monitor counts updated successfully');
        proceedToSummary();
      } else {
        alert.showError(response.message || 'Failed to update client monitor counts');
        // Proceed anyway
        checkForMissingMonitors();
      }
    } catch (error) {
      console.error('Error updating client counts:', error);
      alert.showError('Failed to update client monitor counts. Continuing with report.');
      checkForMissingMonitors();
    }
  };

  const proceedToSummary = () => {
    // Save to report data
    const updatedReport = {
      ...reportData,
      fumigation: {
        areas: selectedAreas,
        otherAreaDescription: selectedAreas.includes('Other') ? otherAreaDescription : null,
        pests: selectedPests,
        otherPestDescription: selectedPests.includes('Other') ? otherPestDescription : null,
        chemicals: chemicalsUsed,
        monitors,
      },
      step: 'summary'
    };
    localStorage.setItem('current_report', JSON.stringify(updatedReport));

    // Navigate to summary
    router.push(`/pco/report/summary?clientId=${clientId}`);
  };

  if (loading) {
    return (
      <ReportLayout title="Fumigation">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout title="Fumigation">
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        {/* Client Info */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-lg">
          <h2 className="text-lg font-bold mb-1">Fumigation Service</h2>
          <p className="text-purple-100">{client?.company_name}</p>
        </div>

        {/* Areas Treated */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Areas Treated *</h3>
          <div className="grid grid-cols-2 gap-2">
            {areasOptions.map(area => (
              <button
                key={area}
                onClick={() => handleToggleArea(area)}
                className={`py-3 px-3 rounded-xl text-sm font-medium transition-all ${
                  selectedAreas.includes(area)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
          {selectedAreas.includes('Other') && (
            <div className="mt-3">
              <TextBox
                type="text"
                label="Please specify other area"
                required
                value={otherAreaDescription}
                onChange={(e) => setOtherAreaDescription(e.target.value)}
                placeholder="e.g., Parking area, Roof"
              />
            </div>
          )}
        </div>

        {/* Target Pests */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Target Pests *</h3>
          <div className="grid grid-cols-2 gap-2">
            {pestOptions.map(pest => (
              <button
                key={pest}
                onClick={() => handleTogglePest(pest)}
                className={`py-3 px-3 rounded-xl text-sm font-medium transition-all ${
                  selectedPests.includes(pest)
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {pest}
              </button>
            ))}
          </div>
          {selectedPests.includes('Other') && (
            <div className="mt-3">
              <TextBox
                type="text"
                label="Please specify other pest"
                required
                value={otherPestDescription}
                onChange={(e) => setOtherPestDescription(e.target.value)}
                placeholder="e.g., Spiders, Beetles"
              />
            </div>
          )}
        </div>

        {/* Chemicals Used */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Chemicals Used *</h3>
          
          {chemicalsUsed.map((chem, index) => (
            <div key={index} className="mb-3 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{chem.chemicalName}</span>
                <button
                  onClick={() => handleRemoveChemical(index)}
                  className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextBox
                  type="number"
                  value={chem.quantity}
                  onChange={(e) => handleUpdateChemical(index, 'quantity', parseFloat(e.target.value))}
                  placeholder="Quantity"
                  step="0.01"
                />
                <TextBox
                  type="text"
                  value={chem.batchNumber}
                  onChange={(e) => handleUpdateChemical(index, 'batchNumber', e.target.value)}
                  placeholder="Batch #"
                />
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowChemicalPicker(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-purple-600 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Chemical
          </button>
        </div>

        {/* Insect Monitors */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">Insect Monitors</h3>
            <div className="text-sm text-gray-600">
              Light: {monitors.filter(m => m.type === 'light').length}/{expectedMonitors.light} • 
              Box: {monitors.filter(m => m.type === 'box').length}/{expectedMonitors.box}
            </div>
          </div>
          
          {monitors.map(monitor => (
            <div key={monitor.id} className="mb-3 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {monitor.type === 'box' ? 'Box Trap' : 'Light Trap'}
                    </span>
                    <span className="font-medium text-gray-900">#{String(monitor.monitorNumber || '')}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {String(monitor.location || '')} • {String(monitor.condition || '')}
                  </div>
                  {monitor.actionTaken && (
                    <div className="text-xs text-gray-500 mt-1">
                      Action: {String(monitor.actionTaken)}
                    </div>
                  )}
                  {monitor.type === 'light' && monitor.glueBoard && monitor.tubesCondition && (
                    <div className="text-xs text-gray-500 mt-1">
                      Glue Board: {String(monitor.glueBoard)} • Tubes: {String(monitor.tubesCondition)}
                    </div>
                  )}
                  {monitor.remarks && (
                    <div className="text-xs text-gray-500 mt-1">
                      {String(monitor.remarks)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteMonitor(monitor.id)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={() => handleAddMonitor('box')}
              className="flex-1 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Box Trap
            </button>
            <button
              onClick={() => handleAddMonitor('light')}
              className="flex-1 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-yellow-600 hover:text-yellow-600 hover:bg-yellow-50 transition-all flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Light Trap
            </button>
          </div>
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
            disabled={selectedAreas.length === 0 || selectedPests.length === 0 || chemicalsUsed.length === 0}
            className="flex-1 px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Summary
          </button>
        </div>
      </div>

      {/* Chemical Picker Modal */}
      {showChemicalPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Select Chemical</h3>
              <button
                onClick={() => setShowChemicalPicker(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {chemicals.map(chemical => (
                <button
                  key={chemical.id}
                  onClick={() => handleAddChemical(chemical)}
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 rounded-xl transition-colors"
                  disabled={chemicalsUsed.some(c => c.chemicalId === chemical.id)}
                >
                  <div className="font-medium text-gray-900">{chemical.name}</div>
                  {chemicalsUsed.some(c => c.chemicalId === chemical.id) && (
                    <div className="text-xs text-gray-500">Already added</div>
                  )}
                </button>
              ))}
              {chemicals.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No chemicals available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monitor Form Modal */}
      {showMonitorForm && editingMonitor && (
        <MonitorForm
          monitor={editingMonitor}
          onSave={handleSaveMonitor}
          onCancel={() => {
            setShowMonitorForm(false);
            setEditingMonitor(null);
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

// Monitor Form Component
function MonitorForm({ 
  monitor, 
  onSave, 
  onCancel 
}: { 
  monitor: InsectMonitor; 
  onSave: (m: InsectMonitor) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<InsectMonitor>(monitor);
  const alert = useAlert();

  const handleSubmit = () => {
    if (!formData.monitorNumber || !formData.location) {
      alert.showWarning('Monitor number and location are required', 'Missing Information');
      return;
    }

    if ((formData.condition === 'needs_repair' || formData.condition === 'damaged') && !formData.actionTaken) {
      alert.showWarning('Please specify action taken for monitor condition', 'Missing Information');
      return;
    }

    if (formData.condition === 'other' && !formData.conditionOther?.trim()) {
      alert.showWarning('Please specify the other condition', 'Missing Information');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {formData.type === 'box' ? 'Box Trap' : 'Light Trap'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Monitor Number */}
          <div>
            <TextBox
              type="text"
              label="Monitor Number"
              required
              value={formData.monitorNumber}
              onChange={(e) => setFormData({ ...formData, monitorNumber: e.target.value })}
              placeholder="Enter monitor number"
            />
          </div>

          {/* Location */}
          <div>
            <TextBox
              type="text"
              label="Location"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Kitchen corner, Near entrance"
            />
          </div>

          {/* Condition */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Monitor Condition *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'good', label: 'Good' },
                { value: 'needs_repair', label: 'Needs Repair' },
                { value: 'damaged', label: 'Damaged' },
                { value: 'missing', label: 'Missing' },
                { value: 'other', label: 'Other' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, condition: option.value as any })}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    formData.condition === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {(formData.condition === 'needs_repair' || formData.condition === 'damaged') && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Taken *
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, actionTaken: 'repaired' })}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                      formData.actionTaken === 'repaired'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Repaired
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, actionTaken: 'replaced' })}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                      formData.actionTaken === 'replaced'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Replaced
                  </button>
                </div>
              </div>
            )}
            
            {formData.condition === 'other' && (
              <div className="mt-3">
                <TextArea
                  label="Specify Other Condition"
                  required
                  value={formData.conditionOther || ''}
                  onChange={(e) => setFormData({ ...formData, conditionOther: e.target.value })}
                  rows={2}
                  placeholder="Describe the monitor condition..."
                  resize="vertical"
                />
              </div>
            )}
          </div>

          {/* Warning Sign Condition */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Warning Sign Condition *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'good', label: 'Good' },
                { value: 'replaced', label: 'Replaced' },
                { value: 'repaired', label: 'Repaired' },
                { value: 'remounted', label: 'Remounted' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, warningSignCondition: option.value as any })}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    formData.warningSignCondition === option.value
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Light Trap Specific Fields */}
          {formData.type === 'light' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Glue Board Condition *
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, glueBoard: 'good' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.glueBoard === 'good'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Good
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, glueBoard: 'replaced' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.glueBoard === 'replaced'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Replaced
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tubes Condition *
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, tubesCondition: 'good' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.tubesCondition === 'good'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Good
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, tubesCondition: 'replaced' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.tubesCondition === 'replaced'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Replaced
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Light Condition *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, lightCondition: 'good', lightFaultyType: undefined, lightFaultyOther: undefined })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.lightCondition === 'good'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, lightCondition: 'faulty' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.lightCondition === 'faulty'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Faulty
                  </button>
                </div>
              </div>

              {/* Light Faulty Type - only show when light is faulty */}
              {formData.lightCondition === 'faulty' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      What is Faulty? *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'starter', label: 'Starter' },
                        { value: 'tube', label: 'Tube' },
                        { value: 'cable', label: 'Cable' },
                        { value: 'electricity', label: 'Electricity' },
                        { value: 'other', label: 'Other' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, lightFaultyType: option.value as any, lightFaultyOther: option.value === 'other' ? formData.lightFaultyOther : undefined })}
                          className={`py-3 px-4 rounded-xl font-medium transition-all ${
                            formData.lightFaultyType === option.value
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Light Faulty Other Description */}
                  {formData.lightFaultyType === 'other' && (
                    <div>
                      <TextArea
                        label="Describe the Issue"
                        required
                        value={formData.lightFaultyOther || ''}
                        onChange={(e) => setFormData({ ...formData, lightFaultyOther: e.target.value })}
                        rows={2}
                        placeholder="e.g., Flickering bulb, loose connection..."
                        resize="vertical"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Remarks */}
          <div>
            <TextArea
              label="Remarks"
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
              placeholder="Additional notes..."
              resize="vertical"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Save Monitor
            </button>
          </div>
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

export default function FumigationPage() {
  return (
    <Suspense fallback={
      <ReportLayout title="Fumigation">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </ReportLayout>
    }>
      <FumigationContent />
    </Suspense>
  );
}
