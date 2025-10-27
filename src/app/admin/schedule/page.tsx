'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Loading from '@/components/Loading';
import { useNotification } from '@/contexts/NotificationContext';
import TextBox from '@/components/TextBox';
import { 
  Calendar,
  Search,
  Users,
  MapPin,
  Building2,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  TrendingUp,
  Filter,
  X
} from 'lucide-react';

interface PCO {
  id: number;
  name: string;
  pco_number: string;
  email: string;
  status: 'active' | 'inactive';
  active_assignments: number;
}

interface Client {
  id: number;
  company_name: string;
  address_line1: string;
  city: string;
  status: 'active' | 'inactive';
  assignment_id?: number; // ID of the client_pco_assignments record
  assigned_pco_id?: number;
  assigned_pco_name?: string;
  assigned_at?: string;
  last_service_date?: string;
  total_reports?: number;
  is_assigned?: number; // 1 if assigned, 0 if not
}

interface Assignment {
  id: number;
  client_id: number;
  client_name: string;
  client_city: string;
  pco_id: number;
  pco_name: string;
  pco_number: string;
  assigned_at: string;
  status: 'active' | 'inactive';
  report_count: number;
  last_service_date?: string;
  service_priority?: 'overdue' | 'due_soon' | 'current' | 'never_serviced';
}

export default function SchedulePage() {
  const notification = useNotification();
  const [loading, setLoading] = useState(true);
  const [pcos, setPcos] = useState<PCO[]>([]);
  const [selectedPco, setSelectedPco] = useState<PCO | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [pcoSearchQuery, setPcoSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedClientsToAssign, setSelectedClientsToAssign] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  useEffect(() => {
    fetchPCOs();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedPco) {
      fetchAssignments(selectedPco.id);
    }
  }, [selectedPco]);

  const fetchPCOs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/users?role=pco&status=${statusFilter}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.data?.users)) {
        setPcos(data.data.users);
        
        // Auto-select first PCO if none selected
        if (!selectedPco && data.data.users.length > 0) {
          setSelectedPco(data.data.users[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching PCOs:', error);
      notification.error('Load Failed', 'Failed to load PCO list');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (pcoId: number) => {
    try {
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/assignments?pco_id=${pcoId}&status=active&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.data?.assignments)) {
        setAssignments(data.data.assignments);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      notification.error('Load Failed', 'Failed to load assignments');
      setAssignments([]);
    }
  };

  const fetchAvailableClients = async () => {
    try {
      const token = localStorage.getItem('kps_token');
      
      // Fetch ALL active clients (not just unassigned) to show assignment status
      const response = await fetch(`http://192.168.1.128:3001/api/admin/clients?status=active&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch clients:', data);
        notification.error('Failed to fetch clients', data.message || 'Unknown error');
        setAvailableClients([]);
        return;
      }

      if (data.success && Array.isArray(data.data?.clients)) {
        setAvailableClients(data.data.clients);
      } else {
        setAvailableClients([]);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      notification.error('Failed to fetch clients', error instanceof Error ? error.message : 'Network error');
      setAvailableClients([]);
    }
  };

  const handleAssignClients = async () => {
    if (!selectedPco || selectedClientsToAssign.length === 0) return;
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/assignments/bulk-assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pco_id: selectedPco.id,
          client_ids: selectedClientsToAssign
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to assign clients');
      }

      setShowAssignModal(false);
      setSelectedClientsToAssign([]);
      notification.success(
        'Clients Assigned',
        `${selectedClientsToAssign.length} client(s) assigned to ${selectedPco.name}`
      );
      fetchAssignments(selectedPco.id);
      fetchPCOs(); // Refresh counts
    } catch (error) {
      console.error('Error assigning clients:', error);
      notification.error('Assignment Failed', error instanceof Error ? error.message : 'Failed to assign clients');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignClient = async () => {
    if (!selectedAssignment) return;
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/assignments/bulk-unassign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assignment_ids: [selectedAssignment.id]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unassign client');
      }

      setShowUnassignModal(false);
      setSelectedAssignment(null);
      notification.success(
        'Client Unassigned',
        `${selectedAssignment.client_name} has been unassigned`
      );
      
      if (selectedPco) {
        fetchAssignments(selectedPco.id);
      }
      fetchPCOs(); // Refresh counts
    } catch (error) {
      console.error('Error unassigning client:', error);
      notification.error('Unassign Failed', error instanceof Error ? error.message : 'Failed to unassign client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignFromModal = async (assignmentId: number, clientName: string) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(`http://192.168.1.128:3001/api/admin/assignments/bulk-unassign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assignment_ids: [assignmentId]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unassign client');
      }

      notification.success(
        'Client Unassigned',
        `${clientName} has been unassigned`
      );
      
      // Update the available clients list to reflect the change
      await fetchAvailableClients();
      
      // Refresh assignments if viewing the same PCO
      if (selectedPco) {
        fetchAssignments(selectedPco.id);
      }
      
      // Refresh PCO counts
      fetchPCOs();
    } catch (error) {
      console.error('Error unassigning client:', error);
      notification.error('Unassign Failed', error instanceof Error ? error.message : 'Failed to unassign client');
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignModal = () => {
    fetchAvailableClients();
    setShowAssignModal(true);
  };

  const openUnassignModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowUnassignModal(true);
  };

  const toggleClientSelection = (clientId: number) => {
    setSelectedClientsToAssign(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const getServicePriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'due_soon':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'current':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'never_serviced':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getServicePriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'overdue':
        return 'Overdue';
      case 'due_soon':
        return 'Due Soon';
      case 'current':
        return 'Current';
      case 'never_serviced':
        return 'Never Serviced';
      default:
        return 'Unknown';
    }
  };

  const getServicePriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'overdue':
        return <AlertCircle className="w-3.5 h-3.5" />;
      case 'due_soon':
        return <Clock className="w-3.5 h-3.5" />;
      case 'current':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'never_serviced':
        return <TrendingUp className="w-3.5 h-3.5" />;
      default:
        return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const filteredPcos = pcos.filter(pco =>
    pco.name.toLowerCase().includes(pcoSearchQuery.toLowerCase()) ||
    pco.pco_number.toLowerCase().includes(pcoSearchQuery.toLowerCase())
  );

  const filteredAvailableClients = availableClients.filter(client =>
    client.company_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.city?.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  if (loading && assignments.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Loading schedule..." />
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
              <Calendar className="w-6 h-6 text-purple-600" />
              Schedule Management
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">Manage PCO assignments and client schedules</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
            </div>
            
            {selectedPco && (
              <button
                onClick={openAssignModal}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Assign Clients
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 h-[calc(100vh-180px)]">
          {/* Left Sidebar - PCO List */}
          <div className="w-80 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
            {/* PCO Search */}
            <div className="p-3 border-b border-gray-200">
              <TextBox
                type="text"
                placeholder="Search PCOs..."
                value={pcoSearchQuery}
                onChange={(e) => setPcoSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-gray-400" />}
              />
            </div>

            {/* PCO List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredPcos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <Users className="w-12 h-12 mb-2 text-gray-300" />
                  <p className="text-sm">No PCOs found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredPcos.map((pco) => (
                    <button
                      key={pco.id}
                      onClick={() => setSelectedPco(pco)}
                      className={`w-full p-3 text-left transition-colors rounded-lg ${
                        selectedPco?.id === pco.id
                          ? 'bg-purple-50 border border-purple-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <UserCheck className="w-4 h-4 text-purple-600" />
                            <h3 className="font-medium text-gray-900 truncate">{pco.name}</h3>
                          </div>
                          <p className="text-xs text-gray-500">PCO #{pco.pco_number}</p>
                        </div>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          pco.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {pco.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{pco.active_assignments || 0} assigned clients</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Content - Assigned Clients */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg shadow-sm">
            {selectedPco ? (
              <>
                {/* Selected PCO Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold mb-0.5">{selectedPco.name}</h3>
                      <p className="text-xs text-purple-100">
                        PCO #{selectedPco.pco_number} • {assignments.length} assigned clients
                      </p>
                    </div>
                  </div>
                </div>

                {/* Assigned Clients Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {assignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Calendar className="w-16 h-16 mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Clients</h3>
                      <p className="text-sm text-gray-600 mb-4">This PCO has no assigned clients yet</p>
                      <button
                        onClick={openAssignModal}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Assign Clients
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="p-4">
                            {/* Client Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-1">{assignment.client_name}</h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <MapPin className="w-3 h-3" />
                                  <span>{assignment.client_city}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => openUnassignModal(assignment)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Unassign Client"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Service Info */}
                            <div className="space-y-2 mb-3">
                              {assignment.last_service_date && (
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Last service: {new Date(assignment.last_service_date).toLocaleDateString()}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{assignment.report_count} reports</span>
                              </div>
                            </div>

                            {/* Service Priority Badge */}
                            {assignment.service_priority && (
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getServicePriorityBadge(assignment.service_priority)}`}>
                                  {getServicePriorityIcon(assignment.service_priority)}
                                  {getServicePriorityLabel(assignment.service_priority)}
                                </span>
                              </div>
                            )}

                            {/* Assigned Date */}
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500">
                                Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <Calendar className="w-16 h-16 mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a PCO</h3>
                <p className="text-sm text-gray-600">Choose a PCO from the left sidebar to view their assigned clients</p>
              </div>
            )}
          </div>
        </div>

      {/* Assign Clients Modal */}
      {showAssignModal && selectedPco && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Assign Clients</h2>
                  <p className="text-xs text-gray-500">Assign clients to {selectedPco.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedClientsToAssign([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <TextBox
                type="text"
                placeholder="Search clients..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-gray-400" />}
              />
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredAvailableClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <Building2 className="w-12 h-12 mb-2 text-gray-300" />
                  <p className="text-sm">No clients found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableClients.map((client) => {
                    const isAssigned = client.is_assigned === 1;
                    const isAssignedToCurrentPco = client.assigned_pco_id === selectedPco.id;
                    const assignmentId = client.assignment_id;
                    
                    return (
                      <div
                        key={client.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                          isAssigned
                            ? 'bg-gray-50 border-gray-200'
                            : selectedClientsToAssign.includes(client.id)
                            ? 'bg-purple-50 border-purple-300'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {/* Assignment Status Dot */}
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${
                            isAssigned ? 'bg-green-500' : 'bg-gray-300'
                          }`} title={isAssigned ? 'Assigned' : 'Unassigned'} />
                        </div>
                        
                        {/* Checkbox - Only show for unassigned clients */}
                        {!isAssigned ? (
                          <label className="flex items-center gap-3 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedClientsToAssign.includes(client.id)}
                              onChange={() => toggleClientSelection(client.id)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">
                                  {client.company_name}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {client.city}
                                </span>
                              </div>
                            </div>
                          </label>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-500">
                                  {client.company_name}
                                </p>
                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                  {isAssignedToCurrentPco ? 'Assigned to this PCO' : `Assigned to ${client.assigned_pco_name}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {client.city}
                                </span>
                              </div>
                            </div>
                            {/* Unassign Button */}
                            {assignmentId && (
                              <button
                                onClick={() => handleUnassignFromModal(assignmentId, client.company_name)}
                                disabled={submitting}
                                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                                title="Unassign this client"
                              >
                                <X className="w-3.5 h-3.5" />
                                Unassign
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                {selectedClientsToAssign.length} client(s) selected
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedClientsToAssign([]);
                  }}
                  disabled={submitting}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignClients}
                  disabled={submitting || selectedClientsToAssign.length === 0}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Assign {selectedClientsToAssign.length > 0 && `(${selectedClientsToAssign.length})`}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Confirmation Modal */}
      {showUnassignModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <UserX className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Unassign Client</h2>
                  <p className="text-xs text-gray-500">Remove assignment from PCO</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to unassign <span className="font-semibold">{selectedAssignment.client_name}</span> from <span className="font-semibold">{selectedPco?.name}</span>?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Client:</span>
                  <span className="font-medium text-gray-900">{selectedAssignment.client_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium text-gray-900">{selectedAssignment.client_city}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Reports:</span>
                  <span className="font-medium text-gray-900">{selectedAssignment.report_count}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowUnassignModal(false);
                  setSelectedAssignment(null);
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleUnassignClient}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Unassigning...
                  </>
                ) : (
                  <>
                    <UserX className="w-4 h-4" />
                    Unassign Client
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
