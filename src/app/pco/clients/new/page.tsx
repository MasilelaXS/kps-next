'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import TextBox from '@/components/TextBox';
import { TextArea } from '@/components/TextArea';
import { useNotification } from '@/contexts/NotificationContext';
import { apiCall, API_CONFIG } from '@/lib/api';
import { Building2, MapPin, Users, Plus, ArrowLeft, Trash2 } from 'lucide-react';

interface NewContact {
  name: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

interface ClientFormData {
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  service_notes: string;
  total_bait_stations_inside: number;
  total_bait_stations_outside: number;
  total_insect_monitors_light: number;
  total_insect_monitors_box: number;
  contacts: NewContact[];
}

export default function PcoCreateClientPage() {
  const router = useRouter();
  const notification = useNotification();
  const [formData, setFormData] = useState<ClientFormData>({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'South Africa',
    service_notes: '',
    total_bait_stations_inside: 0,
    total_bait_stations_outside: 0,
    total_insect_monitors_light: 0,
    total_insect_monitors_box: 0,
    contacts: [{ name: '', email: '', phone: '', is_primary: true }]
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (field: keyof ClientFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: '' });
    }
  };

  const handleContactChange = (index: number, field: keyof NewContact, value: any) => {
    const newContacts = [...formData.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setFormData({ ...formData, contacts: newContacts });
  };

  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [...formData.contacts, { name: '', email: '', phone: '', is_primary: false }]
    });
  };

  const removeContact = (index: number) => {
    if (formData.contacts.length > 1) {
      const newContacts = formData.contacts.filter((_, i) => i !== index);
      setFormData({ ...formData, contacts: newContacts });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      errors.company_name = 'Company name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const response = await apiCall('/api/pco/clients', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response.success) {
        notification.success('Client created successfully');
        router.push('/pco/clients/browse');
        return;
      }

      if (response.errors) {
        const backendErrors: Record<string, string> = {};
        if (Array.isArray(response.errors)) {
          response.errors.forEach((error: any) => {
            if (typeof error === 'object' && error.field && error.message) {
              backendErrors[error.field] = error.message;
            } else if (typeof error === 'string') {
              backendErrors.general = error;
            }
          });
        } else if (typeof response.errors === 'object') {
          Object.assign(backendErrors, response.errors);
        }
        if (Object.keys(backendErrors).length === 0) {
          backendErrors.general = response.message || 'Validation failed';
        }
        setFormErrors(backendErrors);
        return;
      }

      setFormErrors({ general: response.message || 'Failed to create client' });
    } catch (error) {
      console.error('Error creating client:', error);
      setFormErrors({ general: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PcoDashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Client</h1>
            <p className="text-sm text-gray-500 mt-1">Create a new client from the PCO portal.</p>
          </div>
          <Link
            href="/pco/clients/browse"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 space-y-6">
            {formErrors.general && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formErrors.general}
              </div>
            )}

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Company Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <TextBox
                    type="text"
                    label="Company Name"
                    required
                    value={formData.company_name}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    error={formErrors.company_name}
                    placeholder="ABC Restaurant"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600" />
                Address Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => handleInputChange('address_line1', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      formErrors.address_line1 ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="123 Main Street"
                  />
                  {formErrors.address_line1 && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.address_line1}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => handleInputChange('address_line2', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Suite, Unit, Building (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      formErrors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Cape Town"
                  />
                  {formErrors.city && (
                    <p className="mt-1 text-sm text-red-500">{formErrors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Limpopo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="8001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="South Africa"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Equipment Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bait Stations (Inside)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.total_bait_stations_inside}
                    onChange={(e) => handleInputChange('total_bait_stations_inside', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bait Stations (Outside)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.total_bait_stations_outside}
                    onChange={(e) => handleInputChange('total_bait_stations_outside', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insect Monitors (Light)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.total_insect_monitors_light}
                    onChange={(e) => handleInputChange('total_insect_monitors_light', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insect Monitors (Box)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.total_insect_monitors_box}
                    onChange={(e) => handleInputChange('total_insect_monitors_box', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <TextArea
                  label="Service Notes"
                  value={formData.service_notes}
                  onChange={(e) => handleInputChange('service_notes', e.target.value)}
                  rows={4}
                  placeholder="Add any notes about equipment setup, special requirements, or service details..."
                  helperText="Optional notes about the client's equipment or service requirements"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Contacts
                </h4>
                <button
                  type="button"
                  onClick={addContact}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              </div>

              {formErrors.contacts && (
                <p className="mb-4 text-sm text-red-500">{formErrors.contacts}</p>
              )}

              {formData.contacts.map((contact, index) => (
                <div key={index} className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-gray-700">
                      Contact {index + 1}
                      {contact.is_primary && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          Primary
                        </span>
                      )}
                    </h5>
                    {formData.contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="john@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="+27 123 456 789"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={contact.is_primary}
                          onChange={(e) => {
                            const newContacts = formData.contacts.map((c, i) => ({
                              ...c,
                              is_primary: i === index ? e.target.checked : false
                            }));
                            setFormData({ ...formData, contacts: newContacts });
                          }}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        Set as primary contact
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
            <Link
              href="/pco/clients/browse"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Client
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </PcoDashboardLayout>
  );
}
