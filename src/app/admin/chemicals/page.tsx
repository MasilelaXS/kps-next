'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useNotification } from '@/contexts/NotificationContext';
import { 
  Beaker, 
  Search, 
  Plus, 
  Eye,
  Edit,
  Trash2,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface Chemical {
  id: number;
  name: string;
  active_ingredients: string;
  usage_type: 'bait_inspection' | 'fumigation' | 'multi_purpose';
  quantity_unit: string;
  l_number?: string;
  batch_number?: string;
  safety_information?: string;
  status: 'active' | 'inactive';
  usage_count?: number;
  report_count?: number;
  created_at: string;
  updated_at: string;
}

interface PaginationData {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface ChemicalFormData {
  name: string;
  active_ingredients: string;
  usage_type: 'bait_inspection' | 'fumigation' | 'multi_purpose';
  quantity_unit: string;
  l_number: string;
  batch_number: string;
  safety_information: string;
}

export default function ChemicalsPage() {
  const notification = useNotification();
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [usageTypeFilter, setUsageTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<ChemicalFormData>({
    name: '',
    active_ingredients: '',
    usage_type: 'bait_inspection',
    quantity_unit: 'ml',
    l_number: '',
    batch_number: '',
    safety_information: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const prevSearchQuery = useRef<string>('');

  useEffect(() => {
    fetchChemicals();
  }, [pagination.page, usageTypeFilter, statusFilter, activeSearchQuery]);

  useEffect(() => {
    if (searchQuery === '' && prevSearchQuery.current !== '') {
      setActiveSearchQuery('');
      setPagination({ ...pagination, page: 1 });
    }
    prevSearchQuery.current = searchQuery;
  }, [searchQuery]);

  const fetchChemicals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.pageSize.toString(),
      });
      
      if (activeSearchQuery.trim()) {
        params.append('search', activeSearchQuery);
      }
      
      if (usageTypeFilter !== 'all') {
        params.append('usage_type', usageTypeFilter);
      }
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`http://192.168.1.128:3001/api/admin/chemicals?${params}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chemicals');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setChemicals(result.data.chemicals || []);
        if (result.data.pagination) {
          setPagination({
            page: result.data.pagination.current_page,
            pageSize: result.data.pagination.per_page,
            totalItems: result.data.pagination.total_chemicals,
            totalPages: result.data.pagination.total_pages
          });
        }
      }
    } catch (error) {
      console.error('Error fetching chemicals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setActiveSearchQuery(searchQuery.trim());
    setPagination({ ...pagination, page: 1 });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) errors.name = 'Chemical name is required';
    if (!formData.active_ingredients.trim()) errors.active_ingredients = 'Active ingredients are required';
    if (!formData.quantity_unit.trim()) errors.quantity_unit = 'Quantity unit is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      setFormErrors({});
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch('http://192.168.1.128:3001/api/admin/chemicals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const backendErrors: Record<string, string> = {};
          if (Array.isArray(data.errors)) {
            data.errors.forEach((error: any) => {
              if (typeof error === 'object' && error.field && error.message) {
                backendErrors[error.field] = error.message;
              } else if (typeof error === 'string') {
                backendErrors.general = error;
              }
            });
          } else if (typeof data.errors === 'object') {
            Object.assign(backendErrors, data.errors);
          }
          if (Object.keys(backendErrors).length === 0) {
            backendErrors.general = data.message || 'Validation failed';
          }
          setFormErrors(backendErrors);
        } else {
          setFormErrors({ general: data.message || 'Failed to create chemical' });
        }
        return;
      }

      resetForm();
      notification.success('Chemical Created', 'New chemical has been added successfully');
      fetchChemicals();
    } catch (error) {
      console.error('Error creating chemical:', error);
      setFormErrors({ general: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !selectedChemical) return;
    
    try {
      setSubmitting(true);
      setFormErrors({});
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/chemicals/${selectedChemical.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const backendErrors: Record<string, string> = {};
          if (Array.isArray(data.errors)) {
            data.errors.forEach((error: any) => {
              if (typeof error === 'object' && error.field && error.message) {
                backendErrors[error.field] = error.message;
              } else if (typeof error === 'string') {
                backendErrors.general = error;
              }
            });
          } else if (typeof data.errors === 'object') {
            Object.assign(backendErrors, data.errors);
          }
          if (Object.keys(backendErrors).length === 0) {
            backendErrors.general = data.message || 'Validation failed';
          }
          setFormErrors(backendErrors);
        } else {
          setFormErrors({ general: data.message || 'Failed to update chemical' });
        }
        return;
      }

      setShowEditModal(false);
      resetForm();
      notification.success('Chemical Updated', 'Chemical information has been updated successfully');
      fetchChemicals();
    } catch (error) {
      console.error('Error updating chemical:', error);
      setFormErrors({ general: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (chemical: Chemical) => {
    try {
      const token = localStorage.getItem('kps_token');
      const newStatus = chemical.status === 'active' ? 'inactive' : 'active';
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/chemicals/${chemical.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update status');
      }

      notification.success('Status Updated', `Chemical is now ${newStatus}`);
      fetchChemicals();
    } catch (error) {
      console.error('Error updating status:', error);
      notification.error('Update Failed', error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const handleDeleteChemical = async () => {
    if (!selectedChemical) return;
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/chemicals/${selectedChemical.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete chemical');
      }

      setShowDeleteModal(false);
      setSelectedChemical(null);
      
      // Show appropriate notification based on delete type
      if (data.data?.delete_type === 'soft') {
        notification.warning(
          'Chemical Deactivated',
          `${data.message}. ${data.data.note || 'Chemical data preserved for report history.'}`
        );
      } else {
        notification.success(
          'Chemical Deleted',
          data.message || 'Chemical has been permanently deleted'
        );
      }
      
      fetchChemicals();
    } catch (error) {
      console.error('Error deleting chemical:', error);
      notification.error('Delete Failed', error instanceof Error ? error.message : 'Failed to delete chemical');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setFormData({
      name: '',
      active_ingredients: '',
      usage_type: 'bait_inspection',
      quantity_unit: 'ml',
      l_number: '',
      batch_number: '',
      safety_information: ''
    });
    setFormErrors({});
    setSelectedChemical(null);
  };

  const handleEditChemical = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setFormData({
      name: chemical.name,
      active_ingredients: chemical.active_ingredients,
      usage_type: chemical.usage_type,
      quantity_unit: chemical.quantity_unit,
      l_number: chemical.l_number || '',
      batch_number: chemical.batch_number || '',
      safety_information: chemical.safety_information || ''
    });
    setShowEditModal(true);
  };

  const handleViewChemical = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setShowViewModal(true);
  };

  const getUsageTypeBadge = (type: string) => {
    switch (type) {
      case 'bait_inspection':
        return 'bg-blue-100 text-blue-700';
      case 'fumigation':
        return 'bg-purple-100 text-purple-700';
      case 'multi_purpose':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getUsageTypeLabel = (type: string) => {
    switch (type) {
      case 'bait_inspection':
        return 'Bait Inspection';
      case 'fumigation':
        return 'Fumigation';
      case 'multi_purpose':
        return 'Multi-Purpose';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-500';
  };

  if (loading && chemicals.length === 0) {
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
              <Beaker className="w-6 h-6 text-purple-600" />
              Chemicals Management
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">Manage pest control chemicals and products</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Chemical
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              value={usageTypeFilter}
              onChange={(e) => setUsageTypeFilter(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="bait_inspection">Bait Inspection</option>
              <option value="fumigation">Fumigation</option>
              <option value="multi_purpose">Multi-Purpose</option>
            </select>
          </div>
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
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Total Chemicals</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{pagination.totalItems}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Beaker className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Active</p>
              <p className="text-xl font-bold text-green-600 mt-0.5">
                {Array.isArray(chemicals) ? chemicals.filter(c => c.status === 'active').length : 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Bait Inspection</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5">
                {Array.isArray(chemicals) ? chemicals.filter(c => c.usage_type === 'bait_inspection').length : 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Beaker className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Current Page</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">
                {pagination.page} / {pagination.totalPages || 1}
              </p>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Filter className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Chemicals Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chemical
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active Ingredients
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  L Number
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch Number
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!Array.isArray(chemicals) || chemicals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center">
                    <Beaker className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No chemicals found</p>
                    <p className="text-xs text-gray-400 mt-0.5">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                chemicals.map((chemical) => (
                  <tr key={chemical.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-2">
                          <Beaker className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{chemical.name}</div>
                          <div className="text-xs text-gray-500">ID: {chemical.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900 max-w-xs truncate">
                        {chemical.active_ingredients}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs text-gray-900">{chemical.l_number || '-'}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs text-gray-900">{chemical.batch_number || '-'}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getUsageTypeBadge(chemical.usage_type)}`}>
                        {getUsageTypeLabel(chemical.usage_type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs text-gray-900">{chemical.quantity_unit}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(chemical)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(chemical.status)} hover:opacity-80 transition-opacity`}
                      >
                        {chemical.status.charAt(0).toUpperCase() + chemical.status.slice(1)}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleViewChemical(chemical)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleEditChemical(chemical)}
                          className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Edit Chemical"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(chemical)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Chemical"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* Create Chemical Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <form onSubmit={handleSubmit}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-purple-600" />
                  Add New Chemical
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {/* General Error */}
                {formErrors.general && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formErrors.general}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Chemical Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chemical Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        formErrors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Racumin Paste"
                    />
                    {formErrors.name && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Active Ingredients */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Active Ingredients <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.active_ingredients}
                      onChange={(e) => setFormData({ ...formData, active_ingredients: e.target.value })}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        formErrors.active_ingredients ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Coumatetralyl 0.0375%"
                    />
                    {formErrors.active_ingredients && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.active_ingredients}</p>
                    )}
                  </div>

                  {/* L Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      L Number
                    </label>
                    <input
                      type="text"
                      value={formData.l_number}
                      onChange={(e) => setFormData({ ...formData, l_number: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., L12345"
                    />
                  </div>

                  {/* Batch Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Number
                    </label>
                    <input
                      type="text"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., BATCH2025-001"
                    />
                  </div>

                  {/* Usage Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usage Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.usage_type}
                      onChange={(e) => setFormData({ ...formData, usage_type: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="bait_inspection">Bait Inspection</option>
                      <option value="fumigation">Fumigation</option>
                      <option value="multi_purpose">Multi-Purpose</option>
                    </select>
                  </div>

                  {/* Quantity Unit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity Unit <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.quantity_unit}
                      onChange={(e) => setFormData({ ...formData, quantity_unit: e.target.value })}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        formErrors.quantity_unit ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., ml, grams, liters"
                    />
                    {formErrors.quantity_unit && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.quantity_unit}</p>
                    )}
                  </div>

                  {/* Safety Information */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Safety Information
                    </label>
                    <textarea
                      value={formData.safety_information}
                      onChange={(e) => setFormData({ ...formData, safety_information: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="PPE requirements, handling instructions, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Chemical'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Chemical Modal */}
      {showEditModal && selectedChemical && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <form onSubmit={handleUpdate}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-purple-600" />
                  Edit Chemical
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {formErrors.general && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formErrors.general}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Chemical Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chemical Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        formErrors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Active Ingredients */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Active Ingredients <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.active_ingredients}
                      onChange={(e) => setFormData({ ...formData, active_ingredients: e.target.value })}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        formErrors.active_ingredients ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.active_ingredients && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.active_ingredients}</p>
                    )}
                  </div>

                  {/* L Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      L Number
                    </label>
                    <input
                      type="text"
                      value={formData.l_number}
                      onChange={(e) => setFormData({ ...formData, l_number: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., L12345"
                    />
                  </div>

                  {/* Batch Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Number
                    </label>
                    <input
                      type="text"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., BATCH2025-001"
                    />
                  </div>

                  {/* Usage Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usage Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.usage_type}
                      onChange={(e) => setFormData({ ...formData, usage_type: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="bait_inspection">Bait Inspection</option>
                      <option value="fumigation">Fumigation</option>
                      <option value="multi_purpose">Multi-Purpose</option>
                    </select>
                  </div>

                  {/* Quantity Unit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity Unit <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.quantity_unit}
                      onChange={(e) => setFormData({ ...formData, quantity_unit: e.target.value })}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        formErrors.quantity_unit ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.quantity_unit && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.quantity_unit}</p>
                    )}
                  </div>

                  {/* Safety Information */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Safety Information
                    </label>
                    <textarea
                      value={formData.safety_information}
                      onChange={(e) => setFormData({ ...formData, safety_information: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Chemical'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Chemical Modal */}
      {showViewModal && selectedChemical && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                Chemical Details
              </h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Chemical Name</p>
                  <p className="text-sm font-medium text-gray-900">{selectedChemical.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Usage Type</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getUsageTypeBadge(selectedChemical.usage_type)}`}>
                    {getUsageTypeLabel(selectedChemical.usage_type)}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Active Ingredients</p>
                  <p className="text-sm font-medium text-gray-900">{selectedChemical.active_ingredients}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">L Number</p>
                  <p className="text-sm font-medium text-gray-900">{selectedChemical.l_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Batch Number</p>
                  <p className="text-sm font-medium text-gray-900">{selectedChemical.batch_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Quantity Unit</p>
                  <p className="text-sm font-medium text-gray-900">{selectedChemical.quantity_unit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedChemical.status)}`}>
                    {selectedChemical.status.charAt(0).toUpperCase() + selectedChemical.status.slice(1)}
                  </span>
                </div>
                {selectedChemical.safety_information && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Safety Information</p>
                    <p className="text-sm text-gray-700">{selectedChemical.safety_information}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Created At</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(selectedChemical.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Updated At</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(selectedChemical.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditChemical(selectedChemical);
                }}
                className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                Edit Chemical
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedChemical && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Delete Chemical</h2>
                  <p className="text-xs text-gray-500">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  Are you sure you want to delete <span className="font-semibold">{selectedChemical.name}</span>?
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-yellow-800">
                      <p className="font-medium mb-1">Smart Delete:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>If used in reports: Chemical will be <strong>deactivated</strong> (soft delete) to preserve report history</li>
                        <li>If not used: Chemical will be <strong>permanently deleted</strong> (hard delete)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">L Number:</span>
                  <span className="font-medium text-gray-900">{selectedChemical.l_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Batch Number:</span>
                  <span className="font-medium text-gray-900">{selectedChemical.batch_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Active Ingredients:</span>
                  <span className="font-medium text-gray-900 text-right">{selectedChemical.active_ingredients}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedChemical(null);
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChemical}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Chemical
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
