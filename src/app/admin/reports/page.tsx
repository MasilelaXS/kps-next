'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Loading from '@/components/Loading';
import { useNotification } from '@/contexts/NotificationContext';
import { buildApiUrl } from '@/lib/api';
import { 
  FileText,
  Search,
  Filter,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Archive,
  Calendar,
  User,
  Building2,
  AlertCircle,
  Download,
  Mail,
  Trash2
} from 'lucide-react';
import Button from '@/components/Button';

interface Chemical {
  id: number;
  chemical_id: number;
  chemical_name: string;
  quantity: number;
  batch_number: string;
}

interface BaitStation {
  id: number;
  report_id: number;
  location: 'inside' | 'outside';
  station_number: number;
  accessible: 'yes' | 'no';
  not_accessible_reason?: string;
  activity_detected: 'yes' | 'no';
  activity_droppings?: boolean;
  activity_gnawing?: boolean;
  activity_tracks?: boolean;
  activity_other?: string;
  bait_status: 'clean' | 'eaten' | 'wet' | 'old';
  station_condition: 'good' | 'needs_repair' | 'damaged' | 'missing';
  action_taken?: 'repaired' | 'replaced';
  warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted';
  station_remarks?: string;
  chemicals: Chemical[];
}

interface FumigationArea {
  id: number;
  report_id: number;
  area_name: string;
}

interface FumigationTargetPest {
  id: number;
  report_id: number;
  pest_name: string;
}

interface FumigationChemical {
  id: number;
  report_id: number;
  chemical_id: number;
  chemical_name: string;
  quantity: number;
  unit: string;
  batch_number: string;
  active_ingredients?: string;
  safety_information?: string;
}

interface InsectMonitor {
  id: number;
  report_id: number;
  monitor_type: 'box' | 'light_fly_trap';
  monitor_condition: 'good' | 'replaced' | 'repaired' | 'other';
  monitor_condition_other?: string;
  light_condition?: 'good' | 'faulty';
  light_faulty_reason?: 'starter' | 'tube' | 'cable' | 'electricity' | 'other';
  light_faulty_other?: string;
  glue_board_replaced?: 'yes' | 'no';
  tubes_replaced?: 'yes' | 'no';
  warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted';
  monitor_serviced: 'yes' | 'no';
}

interface Report {
  id: number;
  client_id: number;
  client_name: string;
  company_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  pco_id: number;
  pco_name: string;
  pco_number?: string;
  pco_email?: string;
  report_type: 'bait_inspection' | 'fumigation' | 'both';
  service_date: string;
  next_service_date?: string;
  status: 'draft' | 'pending' | 'approved' | 'declined' | 'archived';
  general_remarks?: string;
  recommendations?: string;
  admin_notes?: string;
  pco_signature?: string;
  client_signature?: string;
  client_signature_name?: string;
  created_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: number;
  reviewer_name?: string;
  bait_station_count?: number;
  fumigation_area_count?: number;
  bait_stations?: BaitStation[];
  fumigation?: {
    areas: FumigationArea[];
    target_pests: FumigationTargetPest[];
    chemicals: FumigationChemical[];
  };
  insect_monitors?: InsectMonitor[];
}

interface PaginationData {
  current_page: number;
  total_pages: number;
  total_reports: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

type StatusGroup = 'draft' | 'pending' | 'approved' | 'declined' | 'emailed' | 'archived' | 'all';

export default function ReportsPage() {
  const router = useRouter();
  const notification = useNotification();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [statusGroup, setStatusGroup] = useState<StatusGroup>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    current_page: 1,
    total_pages: 0,
    total_reports: 0,
    per_page: 25,
    has_next: false,
    has_prev: false
  });
  
  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [declineNotes, setDeclineNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  
  // Email modal state
  const [clientContacts, setClientContacts] = useState<any[]>([]);
  const [emailRecipients, setEmailRecipients] = useState<string>('');
  const [emailCC, setEmailCC] = useState<string>('');
  const [emailMessage, setEmailMessage] = useState<string>('');

  // Helper function to handle 401 Unauthorized errors
  const handleUnauthorized = () => {
    console.log('Unauthorized - clearing token and redirecting to login');
    localStorage.removeItem('kps_token');
    localStorage.removeItem('kps_user');
    notification.error('Session Expired', 'Please log in again');
    router.push('/login');
  };

  useEffect(() => {
    fetchReports();
  }, [pagination.current_page, statusGroup, reportTypeFilter, activeSearchQuery, dateFrom, dateTo]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        console.error('No token found in localStorage');
        notification.error('Authentication Required', 'Please log in to view reports');
        setReports([]);
        setLoading(false);
        return;
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: pagination.current_page.toString(),
        limit: pagination.per_page.toString(),
        status_group: statusGroup
      });

      if (reportTypeFilter !== 'all') {
        params.append('report_type', reportTypeFilter);
      }

      if (activeSearchQuery) {
        params.append('search', activeSearchQuery);
      }

      if (dateFrom) {
        params.append('date_from', dateFrom);
      }

      if (dateTo) {
        params.append('date_to', dateTo);
      }

      const response = await fetch(buildApiUrl(`/api/admin/reports?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('API response not ok:', response.status, response.statusText);
        
        // Handle 401 Unauthorized - redirect to login
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data?.reports)) {
        setReports(data.data.reports);
        if (data.data.pagination) {
          setPagination(data.data.pagination);
        }
      } else {
        console.warn('Invalid data structure or unsuccessful response:', data);
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      notification.error('Load Failed', `Failed to load reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    setActiveSearchQuery(searchQuery);
    setPagination({ ...pagination, current_page: 1 });
  }, [searchQuery, pagination]);

  const handleViewReport = useCallback(async (report: Report) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${report.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        setSelectedReport(data.data);
        setShowViewModal(true);
      } else {
        notification.error('Load Failed', 'Failed to load report details');
      }
    } catch (error) {
      console.error('Error fetching report details:', error);
      notification.error('Load Failed', 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  }, [notification]);

  const handleApproveReport = useCallback(async () => {
    if (!selectedReport) return;
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${selectedReport.id}/approve`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_notes: '',
          recommendations: ''
        })
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('Approve failed:', data);
        throw new Error(data.message || 'Failed to approve report');
      }

      setShowApproveModal(false);
      setSelectedReport(null);
      notification.success('Report Approved', 'Report has been approved successfully');
      fetchReports();
    } catch (error) {
      console.error('Error approving report:', error);
      notification.error('Approval Failed', error instanceof Error ? error.message : 'Failed to approve report');
    } finally {
      setSubmitting(false);
    }
  }, [selectedReport, notification, setShowApproveModal, fetchReports]);

  const handleDeclineReport = useCallback(async () => {
    if (!selectedReport || !declineNotes.trim()) {
      notification.error('Validation Error', 'Please provide notes for declining the report');
      return;
    }
    
    if (declineNotes.trim().length < 10) {
      notification.error('Validation Error', 'Decline notes must be at least 10 characters (PCO needs clear feedback for revision)');
      return;
    }
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${selectedReport.id}/decline`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_notes: declineNotes
        })
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('Decline failed:', data);
        throw new Error(data.message || 'Failed to decline report');
      }

      setShowDeclineModal(false);
      setSelectedReport(null);
      setDeclineNotes('');
      notification.success('Report Declined', 'Report has been sent back for revision');
      fetchReports();
    } catch (error) {
      console.error('Error declining report:', error);
      notification.error('Decline Failed', error instanceof Error ? error.message : 'Failed to decline report');
    } finally {
      setSubmitting(false);
    }
  }, [selectedReport, declineNotes, notification, setShowDeclineModal, setDeclineNotes, fetchReports]);

  const handleArchiveReport = useCallback(async () => {
    if (!selectedReport) return;
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${selectedReport.id}/archive`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to archive report');
      }

      setShowArchiveModal(false);
      setSelectedReport(null);
      notification.success('Report Archived', 'Report has been archived');
      fetchReports();
    } catch (error) {
      console.error('Error archiving report:', error);
      notification.error('Archive Failed', error instanceof Error ? error.message : 'Failed to archive report');
    } finally {
      setSubmitting(false);
    }
  }, [selectedReport, notification, setShowArchiveModal, fetchReports]);

  const handleCleanupDrafts = useCallback(async () => {
    try {
      setCleaningUp(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }

      // First, check how many drafts will be deleted
      const countResponse = await fetch(buildApiUrl('/api/cleanup/draft-reports/count'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (countResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      const countData = await countResponse.json();

      if (!countResponse.ok) {
        throw new Error(countData.message || 'Failed to check draft count');
      }

      if (countData.count === 0) {
        notification.info('No Drafts to Clean', 'There are no draft reports older than 72 hours');
        return;
      }

      // Confirm deletion
      if (!confirm(`Delete ${countData.count} draft report(s) older than 72 hours?\n\nThis action cannot be undone.`)) {
        return;
      }

      // Trigger cleanup
      const response = await fetch(buildApiUrl('/api/cleanup/draft-reports/run'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cleanup drafts');
      }

      notification.success('Cleanup Complete', `Successfully deleted ${countData.count} old draft report(s)`);
      
      // Refresh reports if we're on the draft tab
      if (statusGroup === 'draft') {
        fetchReports();
      }
    } catch (error) {
      console.error('Error cleaning up drafts:', error);
      notification.error('Cleanup Failed', error instanceof Error ? error.message : 'Failed to cleanup drafts');
    } finally {
      setCleaningUp(false);
    }
  }, [notification, fetchReports, statusGroup]);

  const handleDownloadPDF = useCallback(async (reportId: number) => {
    try {
      setDownloadingId(reportId);
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }

      notification.info('Generating PDF', 'Please wait while we generate your report...');
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${reportId}/download`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate PDF');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Report_${reportId}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notification.success('PDF Downloaded', 'Report has been downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      notification.error('Download Failed', error instanceof Error ? error.message : 'Failed to download PDF');
    } finally {
      setSubmitting(false);
      setDownloadingId(null);
    }
  }, [notification]);

  const openEmailModal = useCallback(async (report: Report) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }

      // Fetch client contacts
      const response = await fetch(buildApiUrl(`/api/admin/clients/${report.client_id}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (response.ok && data.success && data.data?.contacts) {
        setClientContacts(data.data.contacts);
        
        // Set primary contact as default recipient
        const primaryContact = data.data.contacts.find((c: any) => c.is_primary);
        if (primaryContact?.email) {
          setEmailRecipients(primaryContact.email);
        }
      }

      setSelectedReport(report);
      setShowEmailModal(true);
    } catch (error) {
      console.error('Error loading client contacts:', error);
      notification.error('Failed to Load', 'Could not load client contact information');
    } finally {
      setLoading(false);
    }
  }, [notification, handleUnauthorized]);

  const handleSendEmail = useCallback(async () => {
    if (!selectedReport) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }

      // Validate recipients
      if (!emailRecipients.trim()) {
        notification.error('Validation Error', 'Please specify at least one recipient');
        return;
      }

      notification.info('Sending Email', 'Please wait while we send the report...');
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${selectedReport.id}/email`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: emailRecipients.split(',').map(e => e.trim()).filter(Boolean),
          cc: emailCC ? emailCC.split(',').map(e => e.trim()).filter(Boolean) : undefined,
          additionalMessage: emailMessage.trim() || undefined
        })
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('Email API error response:', data);
        throw new Error(data.message || 'Failed to email report');
      }

      notification.success('Email Sent', data.message || 'Report has been emailed successfully');
      
      // Close modal and reset form
      setShowEmailModal(false);
      setEmailRecipients('');
      setEmailCC('');
      setEmailMessage('');
      setClientContacts([]);
      
      // Refresh reports to update emailed_at timestamp
      fetchReports();
    } catch (error) {
      console.error('Error emailing PDF:', error);
      notification.error('Email Failed', error instanceof Error ? error.message : 'Failed to email report');
    } finally {
      setSubmitting(false);
    }
  }, [selectedReport, emailRecipients, emailCC, emailMessage, notification, handleUnauthorized, fetchReports]);

  const openApproveModal = useCallback(async (report: Report) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${report.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        setSelectedReport(data.data);
        setShowApproveModal(true);
      } else {
        notification.error('Load Failed', 'Failed to load report details');
      }
    } catch (error) {
      console.error('Error fetching report details:', error);
      notification.error('Load Failed', 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  }, [notification]);

  const openDeclineModal = useCallback(async (report: Report) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${report.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        setSelectedReport(data.data);
        setDeclineNotes('');
        setShowDeclineModal(true);
      } else {
        notification.error('Load Failed', 'Failed to load report details');
      }
    } catch (error) {
      console.error('Error fetching report details:', error);
      notification.error('Load Failed', 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  }, [notification]);

  const openArchiveModal = useCallback(async (report: Report) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');
      
      if (!token) {
        handleUnauthorized();
        return;
      }
      
      const response = await fetch(buildApiUrl(`/api/admin/reports/${report.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        setSelectedReport(data.data);
        setShowArchiveModal(true);
      } else {
        notification.error('Load Failed', 'Failed to load report details');
      }
    } catch (error) {
      console.error('Error fetching report details:', error);
      notification.error('Load Failed', 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  }, [notification]);

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'draft':
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'declined':
        return 'bg-red-100 text-red-700';
      case 'archived':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }, []);

  const getReportTypeLabel = useCallback((type: string) => {
    switch (type) {
      case 'bait_inspection':
        return 'Bait Inspection';
      case 'fumigation':
        return 'Fumigation';
      case 'both':
        return 'Both';
      default:
        return 'Unknown';
    }
  }, []);

  const getReportTypeBadge = useCallback((type: string) => {
    switch (type) {
      case 'bait_inspection':
        return 'bg-blue-100 text-blue-700';
      case 'fumigation':
        return 'bg-purple-100 text-purple-700';
      case 'both':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }, []);

  if (loading && reports.length === 0) {
    return (
      <DashboardLayout >
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" text="Loading reports..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout >
      {/* Header - Fixed */}
      <div className="sticky top-14 z-30 bg-gray-50 -mx-4 px-4 py-3 lg:relative lg:top-0 lg:mx-0 lg:px-0 lg:py-0 mb-3 lg:mb-4 border-b lg:border-0 border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
              <span className="hidden sm:inline">Reports Management</span>
              <span className="sm:hidden">Reports</span>
            </h2>
            <p className="text-xs lg:text-sm text-gray-600 mt-0.5 hidden sm:block">Review, approve, and manage service reports</p>
          </div>
          <div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleCleanupDrafts}
              loading={cleaningUp}
              disabled={cleaningUp}
              className="text-xs lg:text-sm"
            >
              <span className="hidden sm:inline">{cleaningUp ? 'Cleaning...' : 'Cleanup Old Drafts'}</span>
              <span className="sm:hidden">Cleanup</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Status Group Tabs - Fixed on mobile */}
      <div className="sticky top-[calc(3.5rem+3.25rem)] lg:top-0 z-20 bg-gray-50 -mx-4 px-4 py-2 lg:relative lg:mx-0 lg:px-0 lg:py-0 mb-3 lg:mb-4 border-b lg:border-0 border-gray-200">
        <div className="bg-white rounded-lg shadow-sm p-2 lg:p-3">
          <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              setStatusGroup('draft');
              setPagination({ ...pagination, current_page: 1 });
            }}
            className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusGroup === 'draft'
                ? 'bg-gray-100 text-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => {
              setStatusGroup('pending');
              setPagination({ ...pagination, current_page: 1 });
            }}
            className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusGroup === 'pending'
                ? 'bg-yellow-100 text-yellow-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => {
              setStatusGroup('approved');
              setPagination({ ...pagination, current_page: 1 });
            }}
            className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusGroup === 'approved'
                ? 'bg-green-100 text-green-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => {
              setStatusGroup('declined');
              setPagination({ ...pagination, current_page: 1 });
            }}
            className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusGroup === 'declined'
                ? 'bg-red-100 text-red-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Declined
          </button>
          <button
            onClick={() => {
              setStatusGroup('emailed');
              setPagination({ ...pagination, current_page: 1 });
            }}
            className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusGroup === 'emailed'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Emailed
          </button>
          <button
            onClick={() => {
              setStatusGroup('archived');
              setPagination({ ...pagination, current_page: 1 });
            }}
            className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusGroup === 'archived'
                ? 'bg-gray-100 text-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Archived
          </button>
          <button
            onClick={() => {
              setStatusGroup('all');
              setPagination({ ...pagination, current_page: 1 });
            }}
            className={`px-3 py-1.5 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              statusGroup === 'all'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Reports
          </button>
        </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-2 lg:p-3 mb-3 lg:mb-4">
        {/* Search - Full width */}
        <div className="relative mb-2 lg:mb-0">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search client or PCO name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Clear search when input is empty
              if (e.target.value === '') {
                setActiveSearchQuery('');
              }
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Filters - Icons only on mobile, full on desktop */}
        <div className="flex gap-2 lg:grid lg:grid-cols-3 lg:gap-2">
          {/* Report Type Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <select
              value={reportTypeFilter}
              onChange={(e) => {
                setReportTypeFilter(e.target.value);
                setPagination({ ...pagination, current_page: 1 });
              }}
              className="w-10 h-10 lg:w-full pl-9 lg:pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white lg:bg-white text-transparent lg:text-gray-900"
              title="Report Type"
            >
              <option value="all">All Types</option>
              <option value="bait_inspection">Bait Inspection</option>
              <option value="fumigation">Fumigation</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Date From */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPagination({ ...pagination, current_page: 1 });
              }}
              className="w-10 h-10 lg:w-full pl-9 lg:pl-3 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-transparent lg:text-gray-900"
              title="From Date"
            />
          </div>

          {/* Date To */}
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPagination({ ...pagination, current_page: 1 });
              }}
              className="w-10 h-10 lg:w-full pl-9 lg:pl-3 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-transparent lg:text-gray-900"
              title="To Date"
            />
          </div>
        </div>
      </div>

      {/* Mobile List View - WhatsApp Style */}
      <div className="lg:hidden space-y-2 mb-4">
        {!Array.isArray(reports) || reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No reports found</p>
            <p className="text-xs text-gray-400 mt-0.5">Try adjusting your filters</p>
          </div>
        ) : (
          reports.map((report) => (
            <div 
              key={report.id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 active:scale-98 transition-transform"
            >
              {/* Top Section - Report Info & Status */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm">#{report.id}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getReportTypeBadge(report.report_type)}`}>
                        {getReportTypeLabel(report.report_type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <Building2 className="w-3 h-3" />
                      <span className="truncate">{report.client_name}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${getStatusBadge(report.status)}`}>
                  {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                </span>
              </div>

              {/* Middle Section - PCO & Date */}
              <div className="flex items-center justify-between text-xs py-2 border-t border-gray-100">
                <div className="flex items-center gap-1 text-gray-600">
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate">{report.pco_name}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(report.service_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

              {/* Bottom Section - Action Buttons */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                <button 
                  onClick={() => handleViewReport(report)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 active:scale-95 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
                
                {(report.status === 'draft' || report.status === 'pending') && (
                  <>
                    <button 
                      onClick={() => router.push(`/admin/reports/${report.id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 active:scale-95 transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button 
                      onClick={() => openApproveModal(report)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 active:scale-95 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  </>
                )}
                
                {report.status === 'approved' && (
                  <>
                    <button 
                      onClick={() => handleDownloadPDF(report.id)}
                      disabled={downloadingId === report.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingId === report.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => openEmailModal(report)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 active:scale-95 transition-all"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </button>
                  </>
                )}
                
                {report.status !== 'archived' && (
                  <button 
                    onClick={() => openArchiveModal(report)}
                    className="px-2 py-1.5 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report ID
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PCO
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service Date
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
              {!Array.isArray(reports) || reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No reports found</p>
                    <p className="text-xs text-gray-400 mt-0.5">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">#{report.id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div className="text-sm text-gray-900">{report.client_name}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div className="text-sm text-gray-900">{report.pco_name}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getReportTypeBadge(report.report_type)}`}>
                        {getReportTypeLabel(report.report_type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-gray-900">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(report.service_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(report.status)}`}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleViewReport(report)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        
                        {(report.status === 'draft' || report.status === 'pending') && (
                          <button 
                            onClick={() => router.push(`/admin/reports/${report.id}/edit`)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Edit Report"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {(report.status === 'draft' || report.status === 'pending') && (
                          <>
                            <button 
                              onClick={() => openApproveModal(report)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve Report"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => openDeclineModal(report)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Decline Report"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        
                        {report.status === 'approved' && (
                          <>
                            <button 
                              onClick={() => handleDownloadPDF(report.id)}
                              disabled={downloadingId === report.id}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={downloadingId === report.id ? 'Downloading...' : 'Download PDF'}
                            >
                              {downloadingId === report.id ? (
                                <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button 
                              onClick={() => openEmailModal(report)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Email Report to Client"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        
                        {report.status !== 'archived' && (
                          <button 
                            onClick={() => openArchiveModal(report)}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Archive Report"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="bg-gray-50 px-3 py-2.5 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-700">
                Showing <span className="font-medium">{((pagination.current_page - 1) * pagination.per_page) + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.current_page * pagination.per_page, pagination.total_reports)}
                </span> of{' '}
                <span className="font-medium">{pagination.total_reports}</span> results
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPagination({ ...pagination, current_page: pagination.current_page - 1 })}
                  disabled={!pagination.has_prev}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.total_pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.current_page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.current_page >= pagination.total_pages - 2) {
                      pageNum = pagination.total_pages - 4 + i;
                    } else {
                      pageNum = pagination.current_page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPagination({ ...pagination, current_page: pageNum })}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                          pagination.current_page === pageNum
                            ? 'bg-purple-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPagination({ ...pagination, current_page: pagination.current_page + 1 })}
                  disabled={!pagination.has_next}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Report Modal */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Report #{selectedReport.id}</h2>
                  <p className="text-sm text-gray-500">{selectedReport.company_name || selectedReport.client_name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Basic Information Section */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Client</p>
                    <p className="text-sm font-medium text-gray-900">{selectedReport.company_name || selectedReport.client_name}</p>
                    {selectedReport.address_line1 && (
                      <p className="text-xs text-gray-600 mt-1">
                        {selectedReport.address_line1}
                        {selectedReport.address_line2 && `, ${selectedReport.address_line2}`}
                        {selectedReport.city && `, ${selectedReport.city}`}
                        {selectedReport.state && ` ${selectedReport.state}`}
                        {selectedReport.postal_code && ` ${selectedReport.postal_code}`}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">PCO</p>
                    <p className="text-sm font-medium text-gray-900">{selectedReport.pco_name}</p>
                    <p className="text-xs text-gray-600 mt-1">#{selectedReport.pco_number}</p>
                    {selectedReport.pco_email && (
                      <p className="text-xs text-gray-600">{selectedReport.pco_email}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Report Type</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getReportTypeBadge(selectedReport.report_type)}`}>
                      {getReportTypeLabel(selectedReport.report_type)}
                    </span>
                    <p className="text-xs text-gray-500 mb-1 mt-3">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedReport.status)}`}>
                      {selectedReport.status.charAt(0).toUpperCase() + selectedReport.status.slice(1)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Service Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedReport.service_date).toLocaleDateString('en-US', { 
                        year: 'numeric', month: 'long', day: 'numeric' 
                      })}
                    </p>
                  </div>
                  {selectedReport.next_service_date && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Next Service Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selectedReport.next_service_date).toLocaleDateString('en-US', { 
                          year: 'numeric', month: 'long', day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                  {selectedReport.reviewer_name && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reviewed By</p>
                      <p className="text-sm font-medium text-gray-900">{selectedReport.reviewer_name}</p>
                      {selectedReport.reviewed_at && (
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(selectedReport.reviewed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bait Stations Section */}
              {selectedReport.bait_stations && selectedReport.bait_stations.length > 0 && (
                <div className="bg-white border-2 border-orange-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      🎯
                    </span>
                    Bait Station Inspections ({selectedReport.bait_stations.length} stations)
                  </h3>
                  
                  {['inside', 'outside'].map(location => {
                    const stationsAtLocation = selectedReport.bait_stations!.filter(
                      (s: BaitStation) => s.location === location
                    );
                    
                    if (stationsAtLocation.length === 0) return null;
                    
                    return (
                      <div key={location} className="mb-6 last:mb-0">
                        <h4 className="text-md font-semibold text-gray-700 mb-3 capitalize bg-orange-50 px-3 py-2 rounded-lg">
                          {location} Stations ({stationsAtLocation.length})
                        </h4>
                        <div className="space-y-3">
                          {stationsAtLocation.map((station: BaitStation) => (
                            <div key={station.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <span className="w-10 h-10 bg-orange-500 text-white rounded-lg flex items-center justify-center font-bold">
                                    {station.station_number}
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">Station #{station.station_number}</p>
                                    <div className="flex gap-2 mt-1">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        station.accessible === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {station.accessible === 'yes' ? '✓ Accessible' : '✗ Not Accessible'}
                                      </span>
                                      {station.activity_detected === 'yes' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                          ⚠ Activity Detected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Bait Status</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    station.bait_status === 'clean' ? 'bg-blue-100 text-blue-700' :
                                    station.bait_status === 'eaten' ? 'bg-red-100 text-red-700' :
                                    station.bait_status === 'wet' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {station.bait_status.charAt(0).toUpperCase() + station.bait_status.slice(1)}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 gap-3 text-xs">
                                {station.accessible === 'no' && station.not_accessible_reason && (
                                  <div className="col-span-4 bg-red-50 p-2 rounded">
                                    <p className="text-red-600"><strong>Reason:</strong> {station.not_accessible_reason}</p>
                                  </div>
                                )}
                                
                                {station.activity_detected === 'yes' && (
                                  <div className="col-span-4">
                                    <p className="text-gray-600 font-medium mb-1">Activity Types:</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {station.activity_droppings && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Droppings</span>}
                                      {station.activity_gnawing && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Gnawing</span>}
                                      {station.activity_tracks && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Tracks</span>}
                                      {station.activity_other && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">{station.activity_other}</span>}
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <p className="text-gray-500">Station Condition</p>
                                  <p className="font-medium text-gray-900">{station.station_condition.replace('_', ' ')}</p>
                                  {station.action_taken && (
                                    <p className="text-green-600 mt-1">✓ {station.action_taken}</p>
                                  )}
                                </div>

                                <div>
                                  <p className="text-gray-500">Warning Sign</p>
                                  <p className="font-medium text-gray-900">{station.warning_sign_condition.replace('_', ' ')}</p>
                                </div>

                                {station.chemicals && station.chemicals.length > 0 && (
                                  <div className="col-span-4">
                                    <p className="text-gray-600 font-medium mb-1">Chemicals Used:</p>
                                    <div className="space-y-1">
                                      {station.chemicals.filter((chem: Chemical) => chem && chem.chemical_name).map((chem: Chemical) => (
                                        <div key={chem.id} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                                          <span className="font-medium text-gray-900">{chem.chemical_name}</span>
                                          <span className="text-gray-600">-</span>
                                          <span className="text-gray-700">Qty: {chem.quantity || 'N/A'}</span>
                                          <span className="text-gray-600">-</span>
                                          <span className="text-gray-500 text-xs">Batch: {chem.batch_number || 'N/A'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {station.station_remarks && (
                                  <div className="col-span-4 bg-blue-50 p-2 rounded">
                                    <p className="text-gray-600"><strong>Remarks:</strong> {station.station_remarks}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fumigation Section */}
              {selectedReport.fumigation && (
                selectedReport.fumigation.areas.length > 0 || 
                selectedReport.fumigation.target_pests.length > 0 || 
                selectedReport.fumigation.chemicals.length > 0
              ) && (
                <div className="bg-white border-2 border-purple-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      💨
                    </span>
                    Fumigation Details
                  </h3>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Areas Treated */}
                    {selectedReport.fumigation.areas.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Areas Treated</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedReport.fumigation.areas.map((area: FumigationArea) => (
                            <span key={area.id} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium">
                              {area.area_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Target Pests */}
                    {selectedReport.fumigation.target_pests.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Target Pests</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedReport.fumigation.target_pests.map((pest: FumigationTargetPest) => (
                            <span key={pest.id} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
                              {pest.pest_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chemicals Used */}
                    {selectedReport.fumigation.chemicals.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Chemicals Used</p>
                        <div className="space-y-2">
                          {selectedReport.fumigation.chemicals.map((chem: FumigationChemical) => (
                            <div key={chem.id} className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-gray-900">{chem.chemical_name}</p>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-gray-700">
                                    <strong>Qty:</strong> {chem.quantity} {chem.unit}
                                  </span>
                                  <span className="text-gray-500 text-xs">
                                    Batch: {chem.batch_number}
                                  </span>
                                </div>
                              </div>
                              {chem.active_ingredients && (
                                <p className="text-xs text-gray-600 mt-1">
                                  <strong>Active Ingredients:</strong> {chem.active_ingredients}
                                </p>
                              )}
                              {chem.safety_information && (
                                <p className="text-xs text-orange-600 mt-1">
                                  <strong>Safety:</strong> {chem.safety_information}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Insect Monitors Section */}
              {selectedReport.insect_monitors && selectedReport.insect_monitors.length > 0 && (
                <div className="bg-white border-2 border-green-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      🔬
                    </span>
                    Insect Monitors ({selectedReport.insect_monitors.length} monitors)
                  </h3>
                  
                  <div className="space-y-3">
                    {selectedReport.insect_monitors.map((monitor: InsectMonitor, index: number) => (
                      <div key={monitor.id} className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 bg-green-500 text-white rounded-lg flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {monitor.monitor_type === 'light_fly_trap' ? 'Light Monitor (Fly Trap)' : 'Box Monitor'}
                              </p>
                              <div className="flex gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  monitor.monitor_serviced === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {monitor.monitor_serviced === 'yes' ? '✓ Serviced' : 'Not Serviced'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-gray-500">Monitor Condition</p>
                            <p className="font-medium text-gray-900">
                              {monitor.monitor_condition === 'other' && monitor.monitor_condition_other
                                ? monitor.monitor_condition_other
                                : monitor.monitor_condition.replace('_', ' ')}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Warning Sign</p>
                            <p className="font-medium text-gray-900">{monitor.warning_sign_condition.replace('_', ' ')}</p>
                          </div>

                          {monitor.monitor_type === 'light_fly_trap' && (
                            <>
                              <div>
                                <p className="text-gray-500">Light Condition</p>
                                <p className={`font-medium ${
                                  monitor.light_condition === 'faulty' ? 'text-red-700' : 'text-green-700'
                                }`}>
                                  {monitor.light_condition || 'N/A'}
                                </p>
                                {monitor.light_condition === 'faulty' && monitor.light_faulty_reason && (
                                  <p className="text-red-600 mt-1">
                                    Reason: {monitor.light_faulty_reason === 'other' && monitor.light_faulty_other
                                      ? monitor.light_faulty_other
                                      : monitor.light_faulty_reason}
                                  </p>
                                )}
                              </div>

                              <div>
                                <p className="text-gray-500">Glue Board Replaced</p>
                                <p className="font-medium text-gray-900">{monitor.glue_board_replaced === 'yes' ? 'Yes' : 'No'}</p>
                              </div>

                              <div>
                                <p className="text-gray-500">Tubes Replaced</p>
                                <p className="font-medium text-gray-900">{monitor.tubes_replaced === 'yes' ? 'Yes' : 'No'}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks and Recommendations Section */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes & Recommendations</h3>
                <div className="space-y-4">
                  {/* General Remarks (PCO) */}
                  {selectedReport.general_remarks && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        PCO Remarks
                      </p>
                      <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                        {selectedReport.general_remarks}
                      </div>
                    </div>
                  )}

                  {/* Recommendations (Admin only) */}
                  {selectedReport.recommendations && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Admin Recommendations
                      </p>
                      <div className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg border border-green-200">
                        {selectedReport.recommendations}
                      </div>
                    </div>
                  )}

                  {/* Admin Notes */}
                  {selectedReport.admin_notes && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        Admin Notes
                      </p>
                      <div className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        {selectedReport.admin_notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Signatures Section */}
              {(selectedReport.pco_signature || selectedReport.client_signature) && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Signatures</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {selectedReport.pco_signature && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">PCO Signature</p>
                        <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                          <img src={selectedReport.pco_signature} alt="PCO Signature" className="max-h-20" />
                          <p className="text-xs text-gray-600 mt-2">{selectedReport.pco_name}</p>
                        </div>
                      </div>
                    )}
                    {selectedReport.client_signature && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Client Signature</p>
                        <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                          <img src={selectedReport.client_signature} alt="Client Signature" className="max-h-20" />
                          {selectedReport.client_signature_name && (
                            <p className="text-xs text-gray-600 mt-2">{selectedReport.client_signature_name}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">Created At</p>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedReport.created_at).toLocaleString()}
                    </p>
                  </div>
                  {selectedReport.submitted_at && (
                    <div>
                      <p className="text-gray-500 mb-1">Submitted At</p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedReport.submitted_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedReport.reviewed_at && (
                    <div>
                      <p className="text-gray-500 mb-1">Reviewed At</p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedReport.reviewed_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              {(selectedReport.status === 'draft' || selectedReport.status === 'pending') && (
                <button
                  onClick={() => router.push(`/admin/reports/${selectedReport.id}/edit`)}
                  className="px-4 py-2 text-sm border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                >
                  Edit Report
                </button>
              )}
              {(selectedReport.status !== 'draft' && selectedReport.status !== 'pending') && <div></div>}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDownloadPDF(selectedReport.id)}
                  disabled={downloadingId === selectedReport.id}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadingId === selectedReport.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download PDF
                    </>
                  )}
                </button>
                <button
                  onClick={() => openEmailModal(selectedReport)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail className="w-4 h-4" />
                  Email Client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedReport && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Approve Report</h2>
                  <p className="text-xs text-gray-500">Confirm report approval</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to approve report <span className="font-semibold">#{selectedReport.id}</span> for <span className="font-semibold">{selectedReport.client_name}</span>?
              </p>
              
              {/* Status Warning */}
              {selectedReport.status !== 'pending' && selectedReport.status !== 'draft' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-800 font-medium">
                    ⚠️ Warning: This report has status "<span className="font-semibold">{selectedReport.status}</span>". 
                    Only reports with status "pending" (or "draft" for older reports) can be approved.
                  </p>
                </div>
              )}
              
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-800">
                  Once approved, this report will be finalized and can be emailed to the client.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveReport}
                disabled={submitting || (selectedReport.status !== 'draft' && selectedReport.status !== 'pending')}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Approve Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showDeclineModal && selectedReport && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Decline Report</h2>
                  <p className="text-xs text-gray-500">Send back for revision</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Provide notes explaining why report <span className="font-semibold">#{selectedReport.id}</span> needs revision:
              </p>
              <textarea
                value={declineNotes}
                onChange={(e) => setDeclineNotes(e.target.value)}
                placeholder="E.g., Please add more detailed bait station remarks and verify chemical quantities..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="bg-yellow-50 rounded-lg p-3 mt-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800">
                    The PCO will receive your notes and can resubmit the report after making corrections.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  setDeclineNotes('');
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeclineReport}
                disabled={submitting || !declineNotes.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Declining...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Decline Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && selectedReport && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Archive className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Archive Report</h2>
                  <p className="text-xs text-gray-500">Move to archived status</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to archive report <span className="font-semibold">#{selectedReport.id}</span>?
              </p>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-700">
                  Archived reports are completed but not for client distribution. They can still be viewed in the Archived section.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowArchiveModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveReport}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    Archive Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Report Modal */}
      {showEmailModal && selectedReport && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Email Report to Client</h2>
                  <p className="text-xs text-gray-500">Report #{selectedReport.id} - {selectedReport.client_name}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Client Contacts Section */}
              {clientContacts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Contacts
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {clientContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => {
                          if (contact.email) {
                            const currentRecipients = emailRecipients.split(',').map(e => e.trim()).filter(Boolean);
                            if (!currentRecipients.includes(contact.email)) {
                              setEmailRecipients(prev => prev ? `${prev}, ${contact.email}` : contact.email);
                            }
                          }
                        }}
                        disabled={!contact.email}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          contact.email 
                            ? 'border-gray-200 hover:border-green-500 hover:bg-green-50 cursor-pointer' 
                            : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {contact.name}
                              {contact.is_primary && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Primary</span>
                              )}
                            </p>
                            {contact.email ? (
                              <p className="text-xs text-gray-600 truncate">{contact.email}</p>
                            ) : (
                              <p className="text-xs text-red-500">No email</p>
                            )}
                            {contact.role && (
                              <p className="text-xs text-gray-500 capitalize">{contact.role.replace('_', ' ')}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Click on a contact to add their email to recipients
                  </p>
                </div>
              )}

              {/* Recipients Field */}
              <div>
                <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipients <span className="text-red-500">*</span>
                </label>
                <input
                  id="recipients"
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separate multiple email addresses with commas
                </p>
              </div>

              {/* CC Field */}
              <div>
                <label htmlFor="cc" className="block text-sm font-medium text-gray-700 mb-1">
                  CC (Optional)
                </label>
                <input
                  id="cc"
                  type="text"
                  value={emailCC}
                  onChange={(e) => setEmailCC(e.target.value)}
                  placeholder="cc1@example.com, cc2@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Additional Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Message (Optional)
                </label>
                <textarea
                  id="message"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Add any additional information or notes for the client..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium mb-1">What will be sent:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Professional PDF report attached</li>
                      <li>Service details and report summary</li>
                      <li>Your additional message (if provided)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailRecipients('');
                  setEmailCC('');
                  setEmailMessage('');
                  setClientContacts([]);
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={submitting || !emailRecipients.trim()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending Email...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Email
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
