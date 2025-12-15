'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import Loading from '@/components/Loading';
import { apiCall } from '@/lib/api';
import { useNotification } from '@/contexts/NotificationContext';
import { Building2, MapPin, Search, Users, AlertCircle, Check } from 'lucide-react';

interface AvailableClient {
  id: number;
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  total_bait_stations_inside: number;
  total_bait_stations_outside: number;
  total_insect_monitors_light: number;
  total_insect_monitors_box: number;
  assignment_status: 'unassigned' | 'assigned_to_other';
  current_pco_name?: string;
  current_pco_number?: string;
}

interface Pagination {
  current_page: number;
  total_pages: number;
  total_clients: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export default function BrowseClientsPage() {
  const router = useRouter();
  const notification = useNotification();
  const [clients, setClients] = useState<AvailableClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [assigningClientId, setAssigningClientId] = useState<number | null>(null);

  useEffect(() => {
    fetchAvailableClients(1, searchQuery);
  }, [searchQuery]);

  const fetchAvailableClients = async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25'
      });
      
      if (search) {
        params.append('search', search);
      }

      const response = await apiCall(`/api/pco/clients/available?${params.toString()}`);
      
      if (response.success && response.data) {
        setClients(response.data.clients || []);
        setPagination(response.data.pagination);
      } else {
        setClients([]);
        setPagination(null);
      }
    } catch (error) {
      console.error('Error fetching available clients:', error);
      notification.error('Failed to load available clients');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const handleSelfAssign = async (client: AvailableClient) => {
    try {
      setAssigningClientId(client.id);
      
      const response = await apiCall('/api/pco/assignments/self-assign', {
        method: 'POST',
        body: JSON.stringify({ client_id: client.id })
      });

      if (response.success) {
        notification.success(`Successfully assigned to ${client.company_name}`);
        
        // Remove from available list
        setClients(prev => prev.filter(c => c.id !== client.id));
        
        // Optionally navigate to schedule
        setTimeout(() => {
          router.push('/pco/schedule');
        }, 1000);
      } else {
        notification.error(response.message || 'Failed to assign to client');
      }
    } catch (error) {
      console.error('Error self-assigning:', error);
      notification.error('Failed to assign to client');
    } finally {
      setAssigningClientId(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchAvailableClients(newPage, searchQuery);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getFullAddress = (client: AvailableClient) => {
    return [
      client.address_line1,
      client.address_line2,
      client.city,
      client.state,
      client.postal_code
    ].filter(Boolean).join(', ');
  };

  const getEquipmentSummary = (client: AvailableClient) => {
    const total_stations = (client.total_bait_stations_inside || 0) + (client.total_bait_stations_outside || 0);
    const total_monitors = (client.total_insect_monitors_light || 0) + (client.total_insect_monitors_box || 0);
    
    return `${total_stations} stations, ${total_monitors} monitors`;
  };

  return (
    <PcoDashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Browse Clients</h1>
            <p className="text-sm text-gray-500 mt-1">
              {pagination ? `${pagination.total_clients} available clients` : 'Loading...'}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by company name, city, or address..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e);
              }
            }}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        )}

        {/* Empty State */}
        {!loading && clients.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No available clients</h3>
            <p className="text-sm text-gray-500">
              {searchQuery 
                ? `No clients found matching "${searchQuery}"`
                : 'All clients are currently assigned'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="mt-4 text-purple-600 hover:text-purple-700 font-medium text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Clients List */}
        {!loading && clients.length > 0 && (
          <div className="space-y-3">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {client.company_name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {client.city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {getEquipmentSummary(client)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Assign Button */}
                  <button
                    onClick={() => handleSelfAssign(client)}
                    disabled={assigningClientId === client.id}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      assigningClientId === client.id
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                    }`}
                  >
                    {assigningClientId === client.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 inline-block mr-1" />
                        Assign to Me
                      </>
                    )}
                  </button>
                </div>

                <div className="text-xs text-gray-600">
                  {getFullAddress(client)}
                </div>

                {/* Assignment Status */}
                {client.assignment_status === 'assigned_to_other' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Currently assigned to {client.current_pco_name} ({client.current_pco_number})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => handlePageChange(pagination.current_page - 1)}
              disabled={!pagination.has_prev}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.current_page + 1)}
              disabled={!pagination.has_next}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </PcoDashboardLayout>
  );
}
