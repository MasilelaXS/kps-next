'use client';

// Admin Schedule Page - Clean imports (fixed HMR issue)
import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Loading from '@/components/Loading';
import { useNotification } from '@/contexts/NotificationContext';
import { 
  Calendar,
  Search,
  Users,
  Building2,
  Plus,
  MapPin,
  Clock,
  User,
  X
} from 'lucide-react';
import CalendarComponent from '@/components/Calendar';
import DayDetailModal from '@/components/DayDetailModal';

interface PCO {
  id: number;
  name: string;
  pco_number: string;
  email: string;
  status: 'active' | 'inactive';
  active_assignments: number;
}

interface CalendarReport {
  id: number;
  client_name: string;
  report_type: string;
  status: string;
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
  assignment_type: 'admin' | 'self';
  status: 'active' | 'inactive';
  report_count: number;
  last_service_date?: string;
  service_priority?: 'overdue' | 'due_soon' | 'current' | 'never_serviced';
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

export default function AdminSchedulePage() {
  const notification = useNotification();

  // State
  const [pcos, setPcos] = useState<PCO[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [activeTab, setActiveTab] = useState<'assignments' | 'calendar'>('calendar');
  const [selectedPco, setSelectedPco] = useState<PCO | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedClientsToAssign, setSelectedClientsToAssign] = useState<number[]>([]);
  const [selectedAssignmentsToUnassign, setSelectedAssignmentsToUnassign] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDayReports, setSelectedDayReports] = useState<CalendarReport[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Effects
  useEffect(() => {
    fetchPCOs();
  }, []);

  useEffect(() => {
    if (selectedPco && activeTab === 'assignments') {
      fetchAssignments(selectedPco.id);
    } else {
      setAssignments([]); // Clear assignments when not in assignments tab or no PCO selected
    }
  }, [selectedPco, activeTab]);

  // Functions
  const fetchPCOs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(buildApiUrl('/api/admin/users?role=pco'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PCOs');
      }

      const data = await response.json();
      setPcos(data.data?.users || []);
    } catch (error) {
      console.error('Error fetching PCOs:', error);
      notification.error('Failed to fetch PCOs', error instanceof Error ? error.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (pcoId: number) => {
    try {
      setLoadingAssignments(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(buildApiUrl(`/api/admin/assignments?pco_id=${pcoId}&status=active&limit=100`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }

      const data = await response.json();
      setAssignments(data.data?.assignments || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      notification.error('Failed to fetch assignments', error instanceof Error ? error.message : 'Network error');
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchAvailableClients = async () => {
    try {
      const token = localStorage.getItem('kps_token');
      
      // Fetch ALL active clients (not just unassigned) to show assignment status
      const response = await fetch(buildApiUrl('/api/admin/clients?status=active&limit=100'), {
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
      
      const response = await fetch(buildApiUrl('/api/admin/assignments/bulk-assign'), {
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
      
      const response = await fetch(buildApiUrl('/api/admin/assignments/bulk-unassign'), {
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

  const handleDayClick = (date: string, reports: CalendarReport[]) => {
    setSelectedDate(date);
    setSelectedDayReports(reports);
    setShowDayDetailModal(true);
  };

  const handleCloseDayModal = () => {
    setShowDayDetailModal(false);
    setSelectedDate('');
    setSelectedDayReports([]);
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

  const toggleAssignmentSelection = (assignmentId: number) => {
    setSelectedAssignmentsToUnassign(prev => 
      prev.includes(assignmentId)
        ? prev.filter(id => id !== assignmentId)
        : [...prev, assignmentId]
    );
  };

  const handleBulkUnassign = async () => {
    if (selectedAssignmentsToUnassign.length === 0) return;
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(buildApiUrl('/api/admin/assignments/bulk-unassign'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assignment_ids: selectedAssignmentsToUnassign
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unassign clients');
      }

      setSelectedAssignmentsToUnassign([]);
      notification.success(
        'Clients Unassigned',
        `${selectedAssignmentsToUnassign.length} client(s) unassigned from ${selectedPco?.name}`
      );
      
      if (selectedPco) {
        fetchAssignments(selectedPco.id);
      }
      fetchPCOs(); // Refresh counts
    } catch (error) {
      console.error('Error bulk unassigning clients:', error);
      notification.error('Bulk Unassign Failed', error instanceof Error ? error.message : 'Failed to unassign clients');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignFromModal = async (assignmentId: number, clientName: string) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      const response = await fetch(buildApiUrl('/api/admin/assignments/bulk-unassign'), {
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

  // Computed values
  const filteredPcos = pcos.filter(pco =>
    pco.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pco.pco_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pco.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAvailableClients = availableClients.filter(client =>
    client.company_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.city?.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  const handleAddAssignment = () => {
    // TODO: Open add assignment modal
    notification.info('Add Assignment', 'Assignment creation feature coming soon');
  };

  if (loading && pcos.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Loading schedule..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-purple-600" />
          Schedule Management
        </h1>
        <p className="text-gray-600 mt-1">
          View and manage PCO schedules and assignments
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'calendar'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            PCO Calendar
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'assignments'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Client Assignments
          </button>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'calendar' ? (
        /* PCO Calendar Tab */
        <div className="flex gap-4 h-[calc(100vh-220px)]">
          {/* PCO List - Sidebar */}
          <div className="w-80 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search PCOs..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* PCO List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loading />
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
                      className={`w-full p-3 text-left transition-all rounded-lg active:scale-98 focus:outline-none border ${
                        selectedPco?.id === pco.id
                          ? 'bg-purple-50 border-purple-200'
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900 truncate text-sm">
                              {pco.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                pco.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {pco.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">
                            PCO #{pco.pco_number}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {pco.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <Building2 className="w-3 h-3 mr-1" />
                        <span>{pco.active_assignments} active assignments</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Calendar View */}
          <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden">
            {selectedPco ? (
              <div className="h-full flex flex-col">
                {/* Calendar Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {selectedPco.name}'s Calendar
                      </h2>
                      <p className="text-sm text-gray-600">
                        PCO #{selectedPco.pco_number} • {selectedPco.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedPco.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {selectedPco.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calendar Component */}
                <div className="flex-1 p-4 overflow-hidden">
                  <CalendarComponent 
                    pcoId={selectedPco.id} 
                    onDayClick={handleDayClick}
                    className="h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Calendar className="w-16 h-16 mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a PCO</h3>
                <p className="text-sm text-gray-600 text-center">Choose a PCO from the list to view their calendar</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PCO Assignments Tab */
        <div className="flex gap-4 h-[calc(100vh-220px)]">
          {/* PCO List - Same sidebar for consistency */}
          <div className="w-80 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search PCOs..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* PCO List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loading />
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
                      className={`w-full p-3 text-left transition-all rounded-lg active:scale-98 focus:outline-none border ${
                        selectedPco?.id === pco.id
                          ? 'bg-purple-50 border-purple-200'
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900 truncate text-sm">
                              {pco.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                pco.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {pco.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">
                            PCO #{pco.pco_number}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {pco.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <Building2 className="w-3 h-3 mr-1" />
                        <span>{pco.active_assignments} active assignments</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignments Details */}
          <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden">
            {selectedPco ? (
              <div className="h-full flex flex-col">
                {/* Assignments Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {selectedPco.name}'s Assignments
                      </h2>
                      <p className="text-sm text-gray-600">
                        PCO #{selectedPco.pco_number} • {selectedPco.active_assignments} active assignments
                      </p>
                    </div>
                    <button 
                      onClick={openAssignModal}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Assignment
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                  {loadingAssignments ? (
                    <div className="flex items-center justify-center h-32">
                      <Loading />
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                      <Building2 className="w-12 h-12 mb-2 text-gray-300" />
                      <p className="text-sm">No assignments found</p>
                    </div>
                  ) : (
                    <>
                      {/* Bulk Actions */}
                      {selectedAssignmentsToUnassign.length > 0 && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-red-700">
                              {selectedAssignmentsToUnassign.length} assignment{selectedAssignmentsToUnassign.length !== 1 ? 's' : ''} selected
                            </span>
                            <button
                              onClick={handleBulkUnassign}
                              disabled={submitting}
                              className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {submitting ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              Bulk Unassign
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {assignments.map((assignment) => {
                          // Determine colors based on assignment type
                          const isSelfAssigned = assignment.assignment_type === 'self';
                          const bgColor = isSelfAssigned ? 'bg-amber-50' : 'bg-gray-50';
                          const borderColor = selectedAssignmentsToUnassign.includes(assignment.id) 
                            ? 'border-red-200' 
                            : isSelfAssigned 
                              ? 'border-amber-200 hover:border-amber-300' 
                              : 'border-gray-200 hover:border-gray-300';
                          const badgeColor = isSelfAssigned 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-green-100 text-green-800';
                          const badgeText = isSelfAssigned ? 'Self-Assigned' : 'Admin Assigned';
                          
                          return (
                            <div key={assignment.id} className={`${bgColor} rounded-lg p-4 border ${borderColor} transition-colors ${
                              selectedAssignmentsToUnassign.includes(assignment.id) ? 'bg-red-50 border-red-200' : ''
                            }`}>
                              <div className="flex items-start gap-3">
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={selectedAssignmentsToUnassign.includes(assignment.id)}
                                  onChange={() => toggleAssignmentSelection(assignment.id)}
                                  className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500 flex-shrink-0"
                                />
                                
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 truncate">
                                    {assignment.client_name}
                                  </h4>
                                  <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <MapPin className="w-3 h-3" />
                                      {assignment.client_city}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <Clock className="w-3 h-3" />
                                      {new Date(assignment.assigned_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                  {assignment.report_count > 0 && (
                                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                      <User className="w-3 h-3" />
                                      {assignment.report_count} report{assignment.report_count !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
                                    {badgeText}
                                  </span>
                                  <button
                                    onClick={() => openUnassignModal(assignment)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Unassign Client"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Building2 className="w-16 h-16 mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a PCO</h3>
                <p className="text-sm text-gray-600 text-center">Choose a PCO from the list to view their assignments</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Day Detail Modal */}
      <DayDetailModal
        isOpen={showDayDetailModal}
        onClose={handleCloseDayModal}
        date={selectedDate}
        reports={selectedDayReports}
        pcoName={selectedPco?.name}
      />

      {/* Assign Clients Modal */}
      {showAssignModal && selectedPco && (
        <div className="fixed inset-0 bg-black/25 flex items-end lg:items-center justify-center lg:p-4 z-50">
          <div className="bg-white rounded-t-xl lg:rounded-xl shadow-2xl w-full lg:max-w-2xl max-h-[90vh] lg:max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 lg:p-4 border-b border-gray-200 bg-white rounded-t-xl z-10 flex-shrink-0">
              <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Plus className="w-4 h-4 lg:w-5 lg:h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base lg:text-lg font-semibold text-gray-900 truncate">Assign Clients</h2>
                  <p className="text-xs text-gray-500 truncate">Assign to {selectedPco.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedClientsToAssign([]);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 lg:p-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-4">
              {filteredAvailableClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <Building2 className="w-10 h-10 lg:w-12 lg:h-12 mb-2 text-gray-300" />
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
                        className={`flex items-center gap-2 lg:gap-3 p-2.5 lg:p-3 border rounded-lg transition-colors ${
                          isAssigned
                            ? 'bg-gray-50 border-gray-200'
                            : selectedClientsToAssign.includes(client.id)
                            ? 'bg-purple-50 border-purple-300'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {/* Assignment Status Dot */}
                        <div className="flex-shrink-0">
                          <div className={`w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full ${
                            isAssigned ? 'bg-green-500' : 'bg-gray-300'
                          }`} title={isAssigned ? 'Assigned' : 'Unassigned'} />
                        </div>

                        {/* Checkbox - Only show for unassigned clients */}
                        {!isAssigned ? (
                          <label className="flex items-center gap-2 lg:gap-3 flex-1 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedClientsToAssign.includes(client.id)}
                              onChange={() => toggleClientSelection(client.id)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm lg:text-base text-gray-900 truncate">
                                {client.company_name}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{client.city}</span>
                              </div>
                            </div>
                          </label>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm lg:text-base text-gray-500 truncate">
                                {client.company_name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{client.city}</span>
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium flex-shrink-0">
                                  {isAssignedToCurrentPco ? 'This PCO' : 'Assigned'}
                                </span>
                              </div>
                            </div>
                            {/* Unassign Button - Show for clients assigned to current PCO */}
                            {assignmentId && isAssignedToCurrentPco && (
                              <button
                                onClick={() => handleUnassignFromModal(assignmentId, client.company_name)}
                                disabled={submitting}
                                className="px-2 lg:px-3 py-1 lg:py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 lg:gap-1.5 whitespace-nowrap flex-shrink-0 active:scale-95"
                                title="Unassign this client"
                              >
                                <X className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                                <span className="hidden lg:inline">Unassign</span>
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
            <div className="flex items-center justify-between p-3 lg:p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 pb-20 lg:pb-3">
              <p className="text-xs lg:text-sm text-gray-600">
                {selectedClientsToAssign.length} selected
              </p>
              <div className="flex gap-2 lg:gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedClientsToAssign([]);
                  }}
                  disabled={submitting}
                  className="px-3 lg:px-4 py-1.5 lg:py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignClients}
                  disabled={submitting || selectedClientsToAssign.length === 0}
                  className="px-3 lg:px-4 py-1.5 lg:py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 lg:gap-2 active:scale-95"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="hidden lg:inline">Assigning...</span>
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
        <div className="fixed inset-0 bg-black/25 flex items-end lg:items-center justify-center lg:p-4 z-50">
          <div className="bg-white rounded-t-xl lg:rounded-xl shadow-2xl w-full lg:max-w-md flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 lg:p-4 border-b border-gray-200 bg-white rounded-t-xl flex-shrink-0">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 lg:w-5 lg:h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-semibold text-gray-900">Unassign Client</h2>
                  <p className="text-xs text-gray-500">Remove assignment from PCO</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUnassignModal(false);
                  setSelectedAssignment(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 lg:p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to unassign <span className="font-semibold">{selectedAssignment.client_name}</span> from <span className="font-semibold">{selectedPco?.name}</span>?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Client:</span>
                  <span className="font-medium text-gray-900 truncate ml-2">{selectedAssignment.client_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium text-gray-900 truncate ml-2">{selectedAssignment.client_city}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Reports:</span>
                  <span className="font-medium text-gray-900">{selectedAssignment.report_count}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 lg:gap-3 p-3 lg:p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 pb-20 lg:pb-3">
              <button
                onClick={() => {
                  setShowUnassignModal(false);
                  setSelectedAssignment(null);
                }}
                disabled={submitting}
                className="px-3 lg:px-4 py-1.5 lg:py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleUnassignClient}
                disabled={submitting}
                className="px-3 lg:px-4 py-1.5 lg:py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 lg:gap-2 active:scale-95"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="hidden lg:inline">Unassigning...</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    Unassign
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