# PCO Dashboard Backend Integration

## Overview
The PCO Dashboard is now fully connected to the backend API, fetching real-time data for stats, recent reports, and activities.

## API Endpoints Used

### 1. Dashboard Summary
**Endpoint:** `GET /api/pco/dashboard/summary`  
**Authentication:** Bearer Token (PCO role required)  
**Description:** Fetches all key metrics in one call

**Response:**
```json
{
  "success": true,
  "data": {
    "assigned_clients_count": 15,
    "pending_reports_count": 3,
    "declined_reports_count": 1,
    "draft_reports_count": 2,
    "total_reports_completed": 45,
    "reports_this_month": 12,
    "reports_this_week": 3,
    "last_report_date": "2025-10-15T10:30:00Z",
    "upcoming_services": 5,
    "performance_metrics": {
      "average_completion_time_days": 2.5,
      "approval_rate_percent": 95.5,
      "reports_per_week_average": 3.2
    }
  }
}
```

### 2. Recent Reports
**Endpoint:** `GET /api/pco/dashboard/recent-reports?limit=5`  
**Authentication:** Bearer Token (PCO role required)  
**Description:** Fetches recent reports for activity feed

**Query Parameters:**
- `limit` - Number of reports to return (default: 10)
- `status` - Filter by status (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "client_name": "ABC Restaurant",
      "service_type": "Monthly Service",
      "status": "approved",
      "report_date": "2025-10-17T14:30:00Z",
      "created_at": "2025-10-17T14:30:00Z"
    }
  ]
}
```

## Features Implemented

### ✅ Real-time Data Fetching
- Fetches dashboard summary on mount
- Fetches recent reports for activity feed
- Automatic data transformation to UI format

### ✅ Error Handling
- Graceful error display with retry button
- Console error logging for debugging
- User-friendly error messages

### ✅ Loading States
- Initial loading spinner
- Refresh loading indicator
- Prevents multiple simultaneous requests

### ✅ Refresh Functionality
- Manual refresh button in header
- Spinning icon during refresh
- Disabled state prevents double-refresh
- Uses separate `refreshing` state (doesn't show full loading screen)

### ✅ Activity Feed
- Transforms report data into activity items
- Calculates "time ago" display (hours/days)
- Maps status to activity type
- Shows client name and service type

## API Configuration

### File: `src/lib/api.ts`

**Features:**
- Centralized API URL configuration
- Environment variable support (`NEXT_PUBLIC_API_URL`)
- Reusable API helper functions
- Automatic auth header injection
- Error handling wrapper

**Usage:**
```typescript
import { API_CONFIG, apiCall } from '@/lib/api';

// Simple GET request
const data = await apiCall(API_CONFIG.ENDPOINTS.PCO_SUMMARY);

// GET with query parameters
const data = await apiCall(`${API_CONFIG.ENDPOINTS.PCO_RECENT_REPORTS}?limit=5`);

// POST request
const data = await apiCall(API_CONFIG.ENDPOINTS.REPORTS, {
  method: 'POST',
  body: JSON.stringify({ ... })
});
```

## Data Flow

### Dashboard Load Sequence
1. **Component Mounts** → `useEffect` triggers `fetchDashboardData()`
2. **Set Loading State** → Show loading spinner
3. **Fetch Summary** → Call `/api/pco/dashboard/summary`
4. **Fetch Recent Reports** → Call `/api/pco/dashboard/recent-reports?limit=5`
5. **Transform Data** → Convert API response to UI state
6. **Update State** → `setStats()` and `setActivities()`
7. **Clear Loading** → Remove spinner, show dashboard

### Manual Refresh Sequence
1. **User Clicks Refresh** → Button in header
2. **Set Refreshing State** → Show spinning icon, disable button
3. **Fetch Data** → Same as initial load
4. **Update State** → Fresh data displayed
5. **Clear Refreshing** → Re-enable button

## Error Handling

### Network Errors
```typescript
try {
  const data = await apiCall(endpoint);
} catch (error) {
  console.error('Error:', error);
  setError('Failed to load dashboard data. Please try again.');
}
```

### Error Display
- Shows alert icon (red circle)
- Display error message
- "Try Again" button to retry
- Maintains app layout (header/nav still visible)

### Error Recovery
- User can retry manually
- Refresh button also clears errors
- No data loss (previous state preserved if refresh fails)

## State Management

### Dashboard State
```typescript
const [stats, setStats] = useState<PCOStats | null>(null);
const [activities, setActivities] = useState<RecentActivity[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [refreshing, setRefreshing] = useState(false);
```

### Loading States
- `loading` - Initial page load (shows full loading screen)
- `refreshing` - Manual refresh (shows small spinner in button)
- Both prevent duplicate requests

## Time Formatting

### "Time Ago" Algorithm
```typescript
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

if (diffDays > 0) {
  timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
} else if (diffHours > 0) {
  timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
} else {
  timeAgo = 'Just now';
}
```

**Examples:**
- 0-59 minutes → "Just now"
- 1 hour → "1 hour ago"
- 5 hours → "5 hours ago"
- 1 day → "1 day ago"
- 3 days → "3 days ago"

## Activity Type Mapping

```typescript
let type: RecentActivity['type'] = 'report_submitted';
if (report.status === 'approved') type = 'report_approved';
else if (report.status === 'declined') type = 'report_declined';
else if (report.status === 'draft') type = 'assignment';
```

**Activity Types:**
- `report_approved` → Green checkmark icon
- `report_declined` → Red X icon
- `report_submitted` → Blue document icon
- `assignment` → Purple clipboard icon

## Environment Configuration

### Development
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Production
```env
NEXT_PUBLIC_API_URL=https://api.yourproduction.com
```

**Default:** Falls back to `http://localhost:3001` if not set

## Testing Checklist

### Backend Running
- [ ] API server running on port 3001
- [ ] Database connected
- [ ] PCO user exists (e.g., pco67890)

### Frontend Testing
- [ ] Login as PCO user
- [ ] Dashboard loads without errors
- [ ] Stats display correctly
- [ ] Recent activity shows
- [ ] Refresh button works
- [ ] Error handling displays properly (stop API to test)
- [ ] Retry button works after error

### Console Checks
```javascript
// Check auth token exists
localStorage.getItem('kps_token')

// Check user data
JSON.parse(localStorage.getItem('kps_user'))

// Network tab
// Should see requests to:
// - /api/pco/dashboard/summary
// - /api/pco/dashboard/recent-reports?limit=5
```

## Future Enhancements

### Real-time Updates
- [ ] WebSocket connection for live updates
- [ ] Push notifications for new assignments
- [ ] Auto-refresh every 5 minutes

### Performance
- [ ] Cache dashboard data in localStorage
- [ ] Optimistic UI updates
- [ ] Skeleton loading states

### Analytics
- [ ] Track dashboard load time
- [ ] Monitor API error rates
- [ ] User engagement metrics

## Troubleshooting

### "Failed to load dashboard data"
**Causes:**
- API server not running
- Wrong API URL in config
- Network connectivity issue
- Auth token expired/invalid
- CORS issue

**Solutions:**
1. Check API server is running: `curl http://192.168.1.128:3001/api/status`
2. Check token in localStorage
3. Check browser console for detailed error
4. Verify CORS headers in API
5. Try logging in again (fresh token)

### Empty Activity Feed
**Causes:**
- No reports exist for this PCO
- Reports exist but have null dates
- API returning empty array

**Solutions:**
1. Check database: `SELECT * FROM reports WHERE pco_user_id = ?`
2. Create test report for this PCO
3. Check API response in Network tab

### Stats Showing 0
**Causes:**
- New PCO with no data
- Database query issue
- Wrong PCO user ID

**Solutions:**
1. Verify PCO has assigned clients
2. Check database assignments table
3. Test API endpoint directly with curl/Postman

## API Documentation Reference

Full API documentation available at:
- PCO Dashboard Routes: `api/src/routes/pcoDashboardRoutes.ts`
- PCO Dashboard Controller: `api/src/controllers/pcoDashboardController.ts`
- SQL Queries: `guides/pco-dashboard.sql`
