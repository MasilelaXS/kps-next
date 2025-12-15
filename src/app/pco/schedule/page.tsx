'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import Loading from '@/components/Loading';
import { API_CONFIG, apiCall } from '@/lib/api';
import { Building2, MapPin, Phone, ChevronRight, AlertCircle, Search } from 'lucide-react';

interface AssignedClient {
  id: number;
  company_name: string;
  address: string;
  is_active: boolean;
  assignment_type?: 'admin' | 'self';
}

export default function SchedulePage() {
  const router = useRouter();
  const [clients, setClients] = useState<AssignedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAssignedClients();
  }, []);

  const fetchAssignedClients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch assigned clients from sync endpoint
      const response = await apiCall('/api/pco/sync/clients?include_contacts=false');
      
      if (response.success && Array.isArray(response.data)) {
        // Map the response to match our interface
        const mappedClients = response.data.map((client: any) => ({
          id: client.id,
          company_name: client.company_name,
          address: [
            client.address_line1,
            client.address_line2,
            client.city,
            client.state,
            client.postal_code
          ].filter(Boolean).join(', '),
          is_active: client.status === 'active',
          assignment_type: client.assignment_type || 'admin'
        }));
        setClients(mappedClients);
      } else {
        setClients([]);
      }
    } catch (error) {
      console.error('Error fetching assigned clients:', error);
      setError('Failed to load your schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientClick = (client: AssignedClient) => {
    if (!client.is_active) {
      // Don't navigate if client is inactive
      return;
    }
    
    // Navigate to report creation with client ID
    router.push(`/pco/report/new?clientId=${client.id}`);
  };

  const filteredClients = clients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.company_name.toLowerCase().includes(query) ||
      client.address.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <PcoDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loading size="lg" text="Loading your schedule..." />
        </div>
      </PcoDashboardLayout>
    );
  }

  if (error) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    
    return (
      <PcoDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Schedule</h3>
            <p className="text-gray-600 mb-4">
              {isOffline 
                ? 'You are currently offline. Please connect to the internet to load your schedule.'
                : error
              }
            </p>
            {!isOffline && (
              <button
                onClick={fetchAssignedClients}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </PcoDashboardLayout>
    );
  }

  return (
    <PcoDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-600 mt-1">Select a client to create a service report</p>
        </div>

        {/* Search and Browse */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assigned clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={() => router.push('/pco/clients/browse')}
            className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:scale-95 transition-all font-medium text-sm whitespace-nowrap"
          >
            + Browse More
          </button>
        </div>

        {/* Assigned Clients List */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No matching clients' : 'No Assigned Clients'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery 
                ? `No clients found matching "${searchQuery}"`
                : "You don't have any clients assigned to you yet."
              }
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/pco/clients/browse')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium text-sm"
              >
                <Search className="w-4 h-4" />
                Browse Available Clients
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => {
              const isSelfAssigned = client.assignment_type === 'self';
              const bgColor = isSelfAssigned ? 'bg-amber-50' : 'bg-white';
              const borderColor = isSelfAssigned ? 'border-amber-200' : 'border-gray-100';
              
              return (
                <button
                  key={client.id}
                  onClick={() => handleClientClick(client)}
                  disabled={!client.is_active}
                  className={`w-full ${bgColor} rounded-2xl p-5 shadow-sm border ${borderColor} text-left transition-all ${
                    client.is_active
                      ? 'active:scale-[0.98] hover:shadow-md'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      client.is_active 
                        ? isSelfAssigned ? 'bg-amber-100' : 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}>
                      <Building2 className={`w-6 h-6 ${
                        client.is_active 
                          ? isSelfAssigned ? 'text-amber-600' : 'text-blue-600'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{client.company_name}</h3>
                      
                      {client.is_active ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Client is currently inactive</span>
                        </div>
                      )}
                    </div>
                    
                    {client.is_active && (
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PcoDashboardLayout>
  );
}
