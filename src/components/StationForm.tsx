'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import TextBox from '@/components/TextBox';
import TextArea from '@/components/TextArea';
import AlertModal from '@/components/AlertModal';
import { useAlert } from '@/hooks/useAlert';

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
  chemicalsUsed: ChemicalUsed[];
  remarks?: string;
  isPrefilled?: boolean;
}

interface StationFormProps {
  station: BaitStation;
  chemicals: Chemical[];
  previousStations?: any[]; // Add previous stations data
  onSave: (station: BaitStation) => void;
  onCancel: () => void;
}

export default function StationForm({ station, chemicals, previousStations = [], onSave, onCancel }: StationFormProps) {
  const [formData, setFormData] = useState<BaitStation>(station);
  const [showChemicalPicker, setShowChemicalPicker] = useState(false);
  const alert = useAlert();

  // Auto-populate when station number changes
  useEffect(() => {
    if (formData.stationNumber && previousStations.length > 0 && !formData.isPrefilled) {
      const matchingStation = previousStations.find(
        (s: any) => s.station_number === formData.stationNumber && s.location === formData.location
      );

      if (matchingStation) {
        // Auto-populate with previous data
        const activityTypes: string[] = [];
        if (matchingStation.activity_droppings) activityTypes.push('droppings');
        if (matchingStation.activity_gnawing) activityTypes.push('gnawing');
        if (matchingStation.activity_tracks) activityTypes.push('tracks');
        if (matchingStation.activity_other) activityTypes.push('other');

        const chemicalsUsed = matchingStation.chemicals?.map((chem: any) => ({
          chemicalId: chem.chemicalId,
          chemicalName: chem.chemicalName,
          quantity: chem.quantity,
          batchNumber: chem.batchNumber,
        })) || [];

        setFormData({
          ...formData,
          accessible: matchingStation.is_accessible,
          activityDetected: matchingStation.activity_detected,
          activityTypes: activityTypes.length > 0 ? activityTypes : undefined,
          activityOtherDesc: matchingStation.activity_other_description || undefined,
          baitStatus: matchingStation.bait_status || 'clean',
          stationCondition: matchingStation.station_condition || 'good',
          warningSignCondition: matchingStation.warning_sign_condition || 'good',
          chemicalsUsed,
          remarks: matchingStation.station_remarks || undefined,
          isPrefilled: true,
        });

        alert.showSuccess(`Station ${formData.stationNumber} data loaded from previous report`, 'Auto-populated');
      }
    }
  }, [formData.stationNumber, formData.location, previousStations]);

  const activityOptions = [
    { value: 'droppings', label: 'Droppings' },
    { value: 'gnawing', label: 'Gnawing' },
    { value: 'tracks', label: 'Tracks' },
    { value: 'other', label: 'Other' },
  ];

  const handleToggleActivity = (activity: string) => {
    const current = formData.activityTypes || [];
    const updated = current.includes(activity)
      ? current.filter(a => a !== activity)
      : [...current, activity];
    setFormData({ ...formData, activityTypes: updated });
  };

  const handleAddChemical = (chemical: Chemical) => {
    const newChemical: ChemicalUsed = {
      chemicalId: chemical.id,
      chemicalName: chemical.name,
      quantity: 0,
      batchNumber: '',
    };
    setFormData({
      ...formData,
      chemicalsUsed: [...formData.chemicalsUsed, newChemical],
    });
    setShowChemicalPicker(false);
  };

  const handleUpdateChemical = (index: number, field: 'quantity' | 'batchNumber', value: string | number) => {
    const updated = [...formData.chemicalsUsed];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, chemicalsUsed: updated });
  };

  const handleRemoveChemical = (index: number) => {
    setFormData({
      ...formData,
      chemicalsUsed: formData.chemicalsUsed.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = () => {
    // Validation
    if (!formData.stationNumber) {
      alert.showWarning('Station number is required', 'Missing Information');
      return;
    }

    if (!formData.accessible && !formData.accessReason) {
      alert.showWarning('Please provide a reason for inaccessibility', 'Missing Information');
      return;
    }

    if (formData.activityDetected && (!formData.activityTypes || formData.activityTypes.length === 0)) {
      alert.showWarning('Please select at least one activity type', 'Missing Information');
      return;
    }

    if ((formData.stationCondition === 'needs_repair' || formData.stationCondition === 'damaged') && !formData.actionTaken) {
      alert.showWarning('Please specify action taken for station condition', 'Missing Information');
      return;
    }

    // Validate chemicals
    for (const chem of formData.chemicalsUsed) {
      if (!chem.quantity || chem.quantity <= 0) {
        alert.showWarning(`Please enter quantity for ${chem.chemicalName}`, 'Missing Information');
        return;
      }
      if (!chem.batchNumber) {
        alert.showWarning(`Please enter batch number for ${chem.chemicalName}`, 'Missing Information');
        return;
      }
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {formData.location.charAt(0).toUpperCase() + formData.location.slice(1)} Station
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Station Number */}
          <div>
            <TextBox
              type="text"
              label="Station Number"
              required
              value={formData.stationNumber}
              onChange={(e) => setFormData({ ...formData, stationNumber: e.target.value })}
              placeholder="Enter station number"
            />
          </div>

          {/* Accessible */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Station Accessible? *
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormData({ ...formData, accessible: true, accessReason: undefined })}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  formData.accessible
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setFormData({ ...formData, accessible: false })}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  !formData.accessible
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                No
              </button>
            </div>
            
            {!formData.accessible && (
              <TextBox
                type="text"
                value={formData.accessReason || ''}
                onChange={(e) => setFormData({ ...formData, accessReason: e.target.value })}
                placeholder="Reason for inaccessibility"
                className="mt-3"
              />
            )}
          </div>

          {/* Activity Detected */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Activity Detected? *
            </label>
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setFormData({ ...formData, activityDetected: true })}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  formData.activityDetected
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setFormData({ ...formData, activityDetected: false, activityTypes: [] })}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  !formData.activityDetected
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                No
              </button>
            </div>

            {formData.activityDetected && (
              <div className="grid grid-cols-2 gap-2">
                {activityOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleToggleActivity(option.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      formData.activityTypes?.includes(option.value)
                        ? 'bg-amber-100 text-amber-900 border-2 border-amber-600'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bait Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bait Status *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['clean', 'eaten', 'wet', 'old'].map(status => (
                <button
                  key={status}
                  onClick={() => {
                    const newFormData = { ...formData, baitStatus: status as any };
                    // If bait is clean, clear all chemicals
                    if (status === 'clean') {
                      newFormData.chemicalsUsed = [];
                    }
                    setFormData(newFormData);
                  }}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    formData.baitStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Station Condition */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Station Condition *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'good', label: 'Good' },
                { value: 'needs_repair', label: 'Needs Repair' },
                { value: 'damaged', label: 'Damaged' },
                { value: 'missing', label: 'Missing' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, stationCondition: option.value as any })}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    formData.stationCondition === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {(formData.stationCondition === 'needs_repair' || formData.stationCondition === 'damaged') && (
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chemicals Used */}
          <div className={formData.baitStatus === 'clean' ? 'opacity-50 pointer-events-none' : ''}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Chemicals Used
              {formData.baitStatus === 'clean' && (
                <span className="ml-2 text-xs text-gray-500">(Not available for clean bait)</span>
              )}
            </label>
            
            {formData.chemicalsUsed.map((chem, index) => (
              <div key={index} className="mb-3 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{chem.chemicalName}</span>
                  <button
                    onClick={() => handleRemoveChemical(index)}
                    className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                    disabled={formData.baitStatus === 'clean'}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextBox
                    type="number"
                    value={chem.quantity}
                    onChange={(e) => handleUpdateChemical(index, 'quantity', parseFloat(e.target.value))}
                    placeholder="Quantity"
                    step="0.01"
                    disabled={formData.baitStatus === 'clean'}
                  />
                  <TextBox
                    type="text"
                    value={chem.batchNumber}
                    onChange={(e) => handleUpdateChemical(index, 'batchNumber', e.target.value)}
                    placeholder="Batch #"
                    disabled={formData.baitStatus === 'clean'}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowChemicalPicker(true)}
              disabled={formData.baitStatus === 'clean'}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Chemical
            </button>
          </div>

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
          <div className="flex gap-3 pt-4">
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
              Save Station
            </button>
          </div>
        </div>
      </div>

      {/* Chemical Picker Modal */}
      {showChemicalPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-xl transition-colors"
                  disabled={formData.chemicalsUsed.some(c => c.chemicalId === chemical.id)}
                >
                  <div className="font-medium text-gray-900">{chemical.name}</div>
                  {formData.chemicalsUsed.some(c => c.chemicalId === chemical.id) && (
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
      
      <AlertModal
        isOpen={alert.isOpen}
        {...alert.config}
        onClose={alert.hideAlert}
      />
    </div>
  );
}
