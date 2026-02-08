'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import Loading from '@/components/Loading';
import { apiCall, offlineAwareApiCall } from '@/lib/api';
import { useNotification } from '@/contexts/NotificationContext';
import { clientCache, type CachedClient } from '@/lib/clientCache';
import Link from 'next/link';
import { Building2, MapPin, Search, Users, AlertCircle, Check, WifiOff, RefreshCw, Download, Plus } from 'lucide-react';

interface AvailableClient {
  id: number;
  company_name: string;
  address_line1: string;
  address_line2?: string;
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
  const [isOffline, setIsOffline] = useState(false);
  const [downloadingCache, setDownloadingCache] = useState(false);

  // Detect online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchAvailableClients(1, searchQuery);
  }, [searchQuery]);

  const fetchAvailableClients = async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      
      // Check if offline - use cached data
      if (!navigator.onLine) {
        console.log('[Browse] Offline - using cached clients');
        const cachedClients = clientCache.getAvailableClients(search);
        
        // Transform cached clients to match AvailableClient interface
        const transformedClients: AvailableClient[] = cachedClients.map(c => ({
          ...c,
          assignment_status: 'unassigned' as const
        }));
        
        setClients(transformedClients);
        setPagination({
          current_page: 1,
          total_pages: 1,
          total_clients: transformedClients.length,
          per_page: transformedClients.length,
          has_next: false,
          has_prev: false
        });
        setLoading(false);
        return;
      }
      
      // Online - fetch from API
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
      
      // Fallback to cache on error
      const cachedClients = clientCache.getAvailableClients(search);
      if (cachedClients.length > 0) {
        console.log('[Browse] API error - falling back to cached clients');
        const transformedClients: AvailableClient[] = cachedClients.map(c => ({
          ...c,
          assignment_status: 'unassigned' as const
        }));
        setClients(transformedClients);
        notification.info('Showing cached clients (offline mode)');
      } else {
        notification.error('Failed to load available clients');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCache = async () => {
    try {
      setDownloadingCache(true);
      notification.info('Downloading clients for offline use...');
      
      const result = await clientCache.downloadAllClients();
      
      if (result.success) {
        notification.success(
          `Downloaded ${result.totalClients} clients (${result.assignedCount} assigned, ${result.availableCount} available) for offline use`
        );
      } else {
        notification.error(result.error || 'Failed to download clients');
      }
    } catch (error) {
      console.error('Error downloading cache:', error);
      notification.error('Failed to download clients');
    } finally {
      setDownloadingCache(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const handleSelfAssign = async (client: AvailableClient) => {
    try {
      setAssigningClientId(client.id);
      
      const response = await offlineAwareApiCall('/api/pco/assignments/self-assign', {
        method: 'POST',
        body: JSON.stringify({ client_id: client.id }),
        type: 'assignment',
        queueIfOffline: true
      });

      if (response.success) {
        if (response.queued) {
          notification.success(`Assignment queued - will sync when online`);
        } else {
          notification.success(`Successfully assigned to ${client.company_name}`);
        }
        
        // Update cache - remove from available, add to assigned
        clientCache.removeFromAvailableCache(client.id);
        clientCache.addToAssignedCache({
          ...client,
          status: 'active'
        });
        
        // Remove from current list
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Browse Clients</h1>
            <p className="text-sm text-gray-500 mt-1">
              {pagination ? `${pagination.total_clients} available clients` : 'Loading...'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/pco/clients/new"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Client
            </Link>

            {!isOffline && (
              <button
                onClick={handleDownloadCache}
                disabled={downloadingCache}
                className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {downloadingCache ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download for Offline
                  </>
                )}
              </button>
            )}
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
