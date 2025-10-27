'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import Loading from '@/components/Loading';
import { apiCall } from '@/lib/api';
import { 
  FileText, 
  Calendar, 
  Building2, 
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface Report {
  id: number;
  client_id: number;
  client_name: string;
  client_city: string;
  report_type: 'bait' | 'fumigation' | 'both';
  service_date: string;
  next_service_date: string;
  status: 'draft' | 'pending' | 'approved' | 'declined' | 'archived';
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  has_pco_signature: number;
  has_client_signature: number;
  bait_stations_count: number;
  fumigation_areas_count: number;
  admin_notes: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export default function PCOReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    declined: 0,
  });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  useEffect(() => {
    fetchStatusCounts();
  }, []);

  const fetchReports = async (page = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        status: statusFilter,
      });

      const response = await apiCall(`/api/pco/reports?${params.toString()}`);

      if (response.success) {
        setReports(response.data);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStatusCounts = async () => {
    try {
      // Fetch counts for each status
      const countPromises = [
        apiCall('/api/pco/reports?page=1&limit=1&status=all'),
        apiCall('/api/pco/reports?page=1&limit=1&status=draft'),
        apiCall('/api/pco/reports?page=1&limit=1&status=pending'),
        apiCall('/api/pco/reports?page=1&limit=1&status=approved'),
        apiCall('/api/pco/reports?page=1&limit=1&status=declined'),
      ];

      const results = await Promise.all(countPromises);

      setStatusCounts({
        all: results[0].success ? results[0].pagination.total_records : 0,
        draft: results[1].success ? results[1].pagination.total_records : 0,
        pending: results[2].success ? results[2].pagination.total_records : 0,
        approved: results[3].success ? results[3].pagination.total_records : 0,
        declined: results[4].success ? results[4].pagination.total_records : 0,
      });
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  };

  const handleRefresh = () => {
    fetchReports(pagination?.page || 1, true);
    fetchStatusCounts();
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      draft: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        icon: FileText,
        label: 'Draft'
      },
      pending: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: Clock,
        label: 'Pending Review'
      },
      approved: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        icon: CheckCircle2,
        label: 'Approved'
      },
      declined: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        icon: XCircle,
        label: 'Declined'
      },
      archived: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        icon: FileText,
        label: 'Archived'
      }
    };

    const config = configs[status as keyof typeof configs] || configs.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getReportTypeLabel = (type: string) => {
    const labels = {
      bait: 'Bait Inspection',
      fumigation: 'Fumigation',
      both: 'Bait & Fumigation'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const filteredReports = reports.filter(report => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      report.client_name.toLowerCase().includes(query) ||
      report.client_city.toLowerCase().includes(query) ||
      report.id.toString().includes(query)
    );
  });

  if (loading) {
    return (
      <PcoDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loading size="lg" />
        </div>
      </PcoDashboardLayout>
    );
  }

  return (
    <PcoDashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-1">
              {statusCounts.all} total reports
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by client name, city, or report ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="relative -mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto pb-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {[
              { value: 'all', label: 'All' },
              { value: 'draft', label: 'Drafts' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'declined', label: 'Declined' }
            ].map((filter, index) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`flex-shrink-0 snap-start px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 flex items-center gap-2 active:scale-95 ${
                  index === 0 ? 'ml-0' : ''
                } ${
                  statusFilter === filter.value
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {statusCounts[filter.value as keyof typeof statusCounts]}
                </span>
              </button>
            ))}
            {/* Padding spacer for last item */}
            <div className="flex-shrink-0 w-1"></div>
          </div>
          {/* Scroll fade indicators */}
          <div className="absolute top-0 left-0 bottom-3 w-8 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none"></div>
          <div className="absolute top-0 right-0 bottom-3 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none"></div>
        </div>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No reports found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery 
                ? 'Try adjusting your search or filters'
                : statusFilter !== 'all'
                ? `No ${statusFilter} reports yet`
                : 'Start creating reports from your schedule'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => {
                  // Navigate based on status
                  if (report.status === 'draft' || report.status === 'declined') {
                    // Navigate to edit/resubmit form
                    router.push(`/pco/report/new?reportId=${report.id}`);
                  } else {
                    // TODO: Navigate to view report details
                    console.log('View report:', report.id);
                  }
                }}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {report.client_name}
                      </h3>
                      {getStatusBadge(report.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {report.client_city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(report.service_date)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">
                      {getReportTypeLabel(report.report_type)}
                    </span>
                    {report.report_type !== 'fumigation' && (
                      <span className="text-gray-600">
                        {report.bait_stations_count} stations
                      </span>
                    )}
                    {report.report_type !== 'bait' && (
                      <span className="text-gray-600">
                        {report.fumigation_areas_count} areas
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    #{report.id}
                  </span>
                </div>

                {/* Show admin notes for declined reports */}
                {report.status === 'declined' && report.admin_notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-700 mb-1">Reason for decline:</p>
                        <p className="text-gray-600">{report.admin_notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => fetchReports(pagination.page - 1)}
              disabled={!pagination.has_previous || loading}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => fetchReports(pagination.page + 1)}
              disabled={!pagination.has_next || loading}
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
