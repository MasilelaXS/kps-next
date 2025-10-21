'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import { API_CONFIG, apiCall } from '@/lib/api';
import { Building2, MapPin, Phone, ChevronRight, AlertCircle } from 'lucide-react';

interface AssignedClient {
  id: number;
  company_name: string;
  address: string;
  is_active: boolean;
}

export default function SchedulePage() {
  const router = useRouter();
  const [clients, setClients] = useState<AssignedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          is_active: client.status === 'active'
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

  if (loading) {
    return (
      <PcoDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your schedule...</p>
          </div>
        </div>
      </PcoDashboardLayout>
    );
  }

  if (error) {
    return (
      <PcoDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Schedule</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchAssignedClients}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
            >
              Try Again
            </button>
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

        {/* Assigned Clients List */}
        {clients.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assigned Clients</h3>
            <p className="text-gray-600">You don't have any clients assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleClientClick(client)}
                disabled={!client.is_active}
                className={`w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-left transition-all ${
                  client.is_active
                    ? 'active:scale-[0.98] hover:shadow-md'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    client.is_active ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Building2 className={`w-6 h-6 ${
                      client.is_active ? 'text-blue-600' : 'text-gray-400'
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
            ))}
          </div>
        )}
      </div>
    </PcoDashboardLayout>
  );
}
