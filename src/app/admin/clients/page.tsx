'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import TextBox from '@/components/TextBox';
import { API_CONFIG } from '@/lib/api';
import { 
  Building2, 
  Search, 
  Plus, 
  MapPin, 
  Phone, 
  Mail,
  Users,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Filter
} from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_primary: boolean;
}

interface Client {
  id: number;
  company_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  status: 'active' | 'inactive' | 'suspended';
  assigned_pco_name?: string;
  assigned_pco_number?: string;
  assigned_at?: string;
  total_reports?: number;
  last_service_date?: string;
  pending_reports?: number;
  created_at: string;
  updated_at: string;
}

interface PaginationData {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface NewContact {
  name: string;
  email: string;
  phone: string;
  role: string;
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
  total_bait_stations_inside: number;
  total_bait_stations_outside: number;
  total_insect_monitors_light: number;
  total_insect_monitors_box: number;
  contacts: NewContact[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'South Africa',
    total_bait_stations_inside: 0,
    total_bait_stations_outside: 0,
    total_insect_monitors_light: 0,
    total_insect_monitors_box: 0,
    contacts: [{ name: '', email: '', phone: '', role: '', is_primary: true }]
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientDetails, setClientDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState(''); // Track active search
  
  // Track previous search query to detect when it's cleared
  const prevSearchQuery = useRef<string>('');

  useEffect(() => {
    fetchClients();
  }, [pagination.page, statusFilter, activeSearchQuery]);

  // Auto-fetch all clients when search is cleared after having content
  useEffect(() => {
    // Only trigger if searchQuery becomes empty AND was previously filled
    if (searchQuery === '' && prevSearchQuery.current !== '') {
      setActiveSearchQuery('');
      setPagination({ ...pagination, page: 1 });
    }
    // Update the ref with current value
    prevSearchQuery.current = searchQuery;
  }, [searchQuery]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.pageSize.toString(),
      });
      
      // Include active search query if it exists
      if (activeSearchQuery.trim()) {
        params.append('search', activeSearchQuery);
      }
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/clients?${params}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setClients(result.data.clients || []);
        if (result.data.pagination) {
          setPagination({
            page: result.data.pagination.current_page,
            pageSize: result.data.pagination.per_page,
            totalItems: result.data.pagination.total_clients,
            totalPages: result.data.pagination.total_pages
          });
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    // Update the active search query and reset to page 1
    setActiveSearchQuery(searchQuery.trim());
    setPagination({ ...pagination, page: 1 });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    };
    return styles[status as keyof typeof styles] || styles.inactive;
  };

  const handleInputChange = (field: keyof ClientFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
    // Clear error for this field
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
      contacts: [...formData.contacts, { name: '', email: '', phone: '', role: '', is_primary: false }]
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
    if (!formData.address_line1.trim()) {
      errors.address_line1 = 'Address is required';
    }
    if (!formData.city.trim()) {
      errors.city = 'City is required';
    }
    if (!formData.state.trim()) {
      errors.state = 'State/Province is required';
    }
    if (!formData.postal_code.trim()) {
      errors.postal_code = 'Postal code is required';
    }

    // Validate at least one contact
    if (formData.contacts.length === 0) {
      errors.contacts = 'At least one contact is required';
    } else {
      formData.contacts.forEach((contact, index) => {
        if (!contact.name.trim()) {
          errors[`contact_${index}_name`] = 'Contact name is required';
        }
        if (!contact.role.trim()) {
          errors[`contact_${index}_role`] = 'Contact role is required';
        }
      });
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
      const token = localStorage.getItem('kps_token');

      console.log('Sending client data:', formData);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/clients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      console.log('Backend response:', data);

      if (response.ok && data.success) {
        // Success - close modal and refresh list
        setShowCreateModal(false);
        setFormData({
          company_name: '',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'South Africa',
          total_bait_stations_inside: 0,
          total_bait_stations_outside: 0,
          total_insect_monitors_light: 0,
          total_insect_monitors_box: 0,
          contacts: [{ name: '', email: '', phone: '', role: '', is_primary: true }]
        });
        fetchClients(); // Refresh the list
      } else {
        // Handle validation errors from backend
        if (data.errors) {
          const backendErrors: Record<string, string> = {};
          if (Array.isArray(data.errors)) {
            // Check if errors are objects with field and message
            data.errors.forEach((error: any) => {
              if (typeof error === 'object' && error.field && error.message) {
                backendErrors[error.field] = error.message;
              } else if (typeof error === 'string') {
                backendErrors.general = error;
              }
            });
          } else if (typeof data.errors === 'object') {
            // If errors is an object, copy all fields
            Object.assign(backendErrors, data.errors);
          }
          // If no errors were mapped, show general message
          if (Object.keys(backendErrors).length === 0) {
            backendErrors.general = data.message || 'Validation failed';
          }
          setFormErrors(backendErrors);
        } else {
          setFormErrors({ general: data.message || 'Failed to create client' });
        }
      }
    } catch (error) {
      console.error('Error creating client:', error);
      setFormErrors({ general: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'South Africa',
      total_bait_stations_inside: 0,
      total_bait_stations_outside: 0,
      total_insect_monitors_light: 0,
      total_insect_monitors_box: 0,
      contacts: [{ name: '', email: '', phone: '', role: '', is_primary: true }]
    });
    setFormErrors({});
    setShowCreateModal(false);
  };

  const fetchClientDetails = async (clientId: number) => {
    try {
      setLoadingDetails(true);
      const token = localStorage.getItem('kps_token');

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/clients/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch client details');
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Backend returns { client, contacts, assignment_history }
        const fullDetails = {
          ...result.data.client,
          contacts: result.data.contacts || [],
          assignment_history: result.data.assignment_history || []
        };
        setClientDetails(fullDetails);
        return fullDetails;
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewClient = async (client: Client) => {
    setSelectedClient(client);
    setShowViewModal(true);
    await fetchClientDetails(client.id);
  };

  const handleEditClient = async (client: Client) => {
    setSelectedClient(client);
    const details = await fetchClientDetails(client.id);
    
    if (details) {
      // Populate form with client data
      setFormData({
        company_name: details.company_name || '',
        address_line1: details.address_line1 || '',
        address_line2: details.address_line2 || '',
        city: details.city || '',
        state: details.state || '',
        postal_code: details.postal_code || '',
        country: details.country || 'South Africa',
        total_bait_stations_inside: details.total_bait_stations_inside || 0,
        total_bait_stations_outside: details.total_bait_stations_outside || 0,
        total_insect_monitors_light: details.total_insect_monitors_light || 0,
        total_insect_monitors_box: details.total_insect_monitors_box || 0,
        contacts: details.contacts && details.contacts.length > 0 
          ? details.contacts 
          : [{ name: '', email: '', phone: '', role: '', is_primary: true }]
      });
      setShowEditModal(true);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !selectedClient) {
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowEditModal(false);
        setSelectedClient(null);
        resetForm();
        fetchClients();
      } else {
        if (data.errors) {
          const backendErrors: Record<string, string> = {};
          if (Array.isArray(data.errors)) {
            // Check if errors are objects with field and message
            data.errors.forEach((error: any) => {
              if (typeof error === 'object' && error.field && error.message) {
                backendErrors[error.field] = error.message;
              } else if (typeof error === 'string') {
                backendErrors.general = error;
              }
            });
          } else if (typeof data.errors === 'object') {
            // If errors is an object, copy all fields
            Object.assign(backendErrors, data.errors);
          }
          // If no errors were mapped, show general message
          if (Object.keys(backendErrors).length === 0) {
            backendErrors.general = data.message || 'Validation failed';
          }
          setFormErrors(backendErrors);
        } else {
          setFormErrors({ general: data.message || 'Failed to update client' });
        }
      }
    } catch (error) {
      console.error('Error updating client:', error);
      setFormErrors({ general: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = (client: Client) => {
    setSelectedClient(client);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedClient) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/admin/clients/${selectedClient.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowDeleteModal(false);
        setSelectedClient(null);
        fetchClients();
      } else {
        alert(data.message || 'Failed to delete client');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && clients.length === 0) {
    return (
      <DashboardLayout >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              Clients Management
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">Manage your client accounts and information</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Client
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <TextBox
              type="text"
              placeholder="Search clients by name, address, or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              icon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Search
          </button>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Total Clients</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{pagination.totalItems}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Active</p>
              <p className="text-xl font-bold text-green-600 mt-0.5">
                {Array.isArray(clients) ? clients.filter(c => c.status === 'active').length : 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Inactive</p>
              <p className="text-xl font-bold text-gray-600 mt-0.5">
                {Array.isArray(clients) ? clients.filter(c => c.status === 'inactive').length : 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Current Page</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5">
                {pagination.page} / {pagination.totalPages || 1}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned PCO
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reports
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Service
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!Array.isArray(clients) || clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center">
                    <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No clients found</p>
                    <p className="text-xs text-gray-400 mt-0.5">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-2">
                            <Building2 className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{client.company_name || 'Unnamed Client'}</div>
                            <div className="text-xs text-gray-500">ID: {client.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs text-gray-900">{client.address_line1 || 'No address'}</div>
                            {client.address_line2 && (
                              <div className="text-xs text-gray-500">{client.address_line2}</div>
                            )}
                            <div className="text-xs text-gray-500">
                              {client.city || 'Unknown city'}{client.state ? `, ${client.state}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {client.assigned_pco_name ? (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-900">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              {client.assigned_pco_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              PCO #{client.assigned_pco_number}
                            </div>
                            {client.assigned_at && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {new Date(client.assigned_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No PCO</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {client.status ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(client.status)}`}>
                            {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{client.total_reports || 0}</div>
                        {client.pending_reports && client.pending_reports > 0 && (
                          <div className="text-xs text-orange-600 mt-0.5">
                            {client.pending_reports} pending
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {client.last_service_date ? (
                          <div>
                            <div className="text-xs text-gray-900">
                              {new Date(client.last_service_date).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">Last service</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No service</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleViewClient(client)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleEditClient(client)}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Edit Client"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClient(client)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-3 py-2.5 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-700">
                Showing <span className="font-medium">{((pagination.page - 1) * pagination.pageSize) + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
                </span> of{' '}
                <span className="font-medium">{pagination.totalItems}</span> results
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPagination({ ...pagination, page: pageNum })}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          pagination.page === pageNum
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl my-8">
            <form onSubmit={handleSubmit}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-purple-600" />
                  Create New Client
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* General Error */}
                {formErrors.general && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formErrors.general}
                  </div>
                )}

                {/* Company Information */}
                <div className="mb-8">
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

                {/* Address Information */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    Address Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Line 1 <span className="text-red-500">*</span>
                      </label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
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
                        placeholder="Western Cape"
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

                {/* Equipment Counts */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Equipment Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bait Stations (Inside)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_bait_stations_inside}
                        onChange={(e) => handleInputChange('total_bait_stations_inside', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bait Stations (Outside)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_bait_stations_outside}
                        onChange={(e) => handleInputChange('total_bait_stations_outside', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Insect Monitors (Light)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_insect_monitors_light}
                        onChange={(e) => handleInputChange('total_insect_monitors_light', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Insect Monitors (Box)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_insect_monitors_box}
                        onChange={(e) => handleInputChange('total_insect_monitors_box', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      Contacts <span className="text-red-500">*</span>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                              formErrors[`contact_${index}_name`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="John Doe"
                          />
                          {formErrors[`contact_${index}_name`] && (
                            <p className="mt-1 text-xs text-red-500">{formErrors[`contact_${index}_name`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={contact.role}
                            onChange={(e) => handleContactChange(index, 'role', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                              formErrors[`contact_${index}_role`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select Role</option>
                            <option value="primary">Primary Contact</option>
                            <option value="billing">Billing Contact</option>
                            <option value="site_manager">Site Manager</option>
                            <option value="emergency">Emergency Contact</option>
                            <option value="other">Other</option>
                          </select>
                          {formErrors[`contact_${index}_role`] && (
                            <p className="mt-1 text-xs text-red-500">{formErrors[`contact_${index}_role`]}</p>
                          )}
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
                                // Unset other primary contacts
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

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
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
        </div>
      )}

      {/* View Client Modal */}
      {showViewModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-purple-600" />
                Client Details
              </h3>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedClient(null);
                  setClientDetails(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
              ) : clientDetails ? (
                <div className="space-y-6">
                  {/* Company Info */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Company Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Company Name</p>
                        <p className="text-base font-medium text-gray-900">{clientDetails.company_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        {clientDetails.status ? (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(clientDetails.status)}`}>
                            {clientDetails.status.charAt(0).toUpperCase() + clientDetails.status.slice(1)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Address</h4>
                    <div className="text-gray-700 space-y-1">
                      <p>{clientDetails.address_line1 || 'No address provided'}</p>
                      {clientDetails.address_line2 && <p>{clientDetails.address_line2}</p>}
                      <p>
                        {clientDetails.city || 'Unknown city'}
                        {clientDetails.state && `, ${clientDetails.state}`}
                        {clientDetails.postal_code && ` ${clientDetails.postal_code}`}
                      </p>
                      {clientDetails.country && <p>{clientDetails.country}</p>}
                    </div>
                  </div>

                  {/* Equipment */}
                  {(clientDetails.total_bait_stations_inside || clientDetails.total_bait_stations_outside || 
                    clientDetails.total_insect_monitors_light || clientDetails.total_insect_monitors_box) && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Equipment</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Bait Stations (Inside)</p>
                          <p className="text-base font-medium text-gray-900">{clientDetails.total_bait_stations_inside || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Bait Stations (Outside)</p>
                          <p className="text-base font-medium text-gray-900">{clientDetails.total_bait_stations_outside || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Insect Monitors (Light)</p>
                          <p className="text-base font-medium text-gray-900">{clientDetails.total_insect_monitors_light || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Insect Monitors (Box)</p>
                          <p className="text-base font-medium text-gray-900">{clientDetails.total_insect_monitors_box || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contacts */}
                  {clientDetails.contacts && clientDetails.contacts.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Contacts</h4>
                      <div className="space-y-3">
                        {clientDetails.contacts.map((contact: any, index: number) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{contact.name}</span>
                              {contact.is_primary && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{contact.role}</p>
                            {contact.email && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </p>
                            )}
                            {contact.phone && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" />
                                {contact.phone}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">Failed to load client details</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedClient(null);
                  setClientDetails(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditClient(selectedClient);
                }}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl my-8">
            <form onSubmit={handleUpdateClient}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit className="w-6 h-6 text-purple-600" />
                  Edit Client
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedClient(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Use the same form body as create modal */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {formErrors.general && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formErrors.general}
                  </div>
                )}

                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-600" />
                    Company Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                          formErrors.company_name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.company_name && (
                        <p className="mt-1 text-sm text-red-500">{formErrors.company_name}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    Address Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Line 1 <span className="text-red-500">*</span>
                      </label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
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
                        placeholder="Western Cape"
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

                {/* Equipment Counts */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Equipment Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bait Stations (Inside)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_bait_stations_inside}
                        onChange={(e) => handleInputChange('total_bait_stations_inside', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bait Stations (Outside)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_bait_stations_outside}
                        onChange={(e) => handleInputChange('total_bait_stations_outside', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Insect Monitors (Light)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_insect_monitors_light}
                        onChange={(e) => handleInputChange('total_insect_monitors_light', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Insect Monitors (Box)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.total_insect_monitors_box}
                        onChange={(e) => handleInputChange('total_insect_monitors_box', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      Contacts <span className="text-red-500">*</span>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                              formErrors[`contact_${index}_name`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="John Doe"
                          />
                          {formErrors[`contact_${index}_name`] && (
                            <p className="mt-1 text-xs text-red-500">{formErrors[`contact_${index}_name`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={contact.role}
                            onChange={(e) => handleContactChange(index, 'role', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                              formErrors[`contact_${index}_role`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select Role</option>
                            <option value="primary">Primary Contact</option>
                            <option value="billing">Billing Contact</option>
                            <option value="site_manager">Site Manager</option>
                            <option value="emergency">Emergency Contact</option>
                            <option value="other">Other</option>
                          </select>
                          {formErrors[`contact_${index}_role`] && (
                            <p className="mt-1 text-xs text-red-500">{formErrors[`contact_${index}_role`]}</p>
                          )}
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

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedClient(null);
                    resetForm();
                  }}
                  disabled={submitting}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      Update Client
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Client</h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete <span className="font-semibold">{selectedClient.company_name}</span>? 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedClient(null);
                  }}
                  disabled={submitting}
                  className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={submitting}
                  className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
