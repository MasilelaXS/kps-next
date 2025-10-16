# Phase 4.1: PCO Dashboard Implementation Plan

**Date**: October 14, 2025  
**Priority**: 🔥 High (Mobile App Critical Feature)  
**Estimated Endpoints**: 5-7  
**Status**: 🚀 Ready to Begin

---

## Overview

The PCO Dashboard is the home screen of the mobile application. It provides at-a-glance metrics, quick actions, and navigation to key features. Per workflow.md, it must display:

- Assigned clients count
- Pending reports count
- Reports needing revision (declined reports)
- Quick access to create new report
- Service history summary

---

## Endpoints to Implement

### 1. GET /api/pco/dashboard/summary
**Purpose**: Main dashboard data - all key metrics in one call

**Response Data**:
```json
{
  "success": true,
  "data": {
    "assigned_clients_count": 12,
    "pending_reports_count": 3,
    "declined_reports_count": 2,
    "draft_reports_count": 1,
    "total_reports_completed": 45,
    "reports_this_month": 8,
    "reports_this_week": 3,
    "last_report_date": "2025-10-13",
    "upcoming_services": 5,
    "performance_metrics": {
      "average_completion_time_days": 1.5,
      "approval_rate_percent": 92.5,
      "reports_per_week_average": 2.8
    }
  }
}
```

**Business Logic**:
- Count assigned clients (status='active')
- Count pending reports (submitted, awaiting review)
- Count declined reports (need revision - status='draft' with admin_notes)
- Count draft reports (work in progress)
- Total completed reports (status='approved')
- Performance calculations based on last 30 days

**Cache Strategy**: 5-minute cache recommended

---

### 2. GET /api/pco/dashboard/upcoming-assignments
**Purpose**: Show clients needing service soon

**Query Parameters**:
- `days_ahead` (default: 7) - look ahead window
- `limit` (default: 10)

**Response Data**:
```json
{
  "success": true,
  "data": {
    "assignments": [
      {
        "client_id": 1,
        "company_name": "ABC Restaurant",
        "city": "Cape Town",
        "last_service_date": "2025-10-01",
        "next_service_date": "2025-10-15",
        "days_until_service": 1,
        "service_frequency": "bi_weekly",
        "has_draft": false,
        "priority": "high"
      }
    ],
    "total_upcoming": 5
  }
}
```

**Business Logic**:
- Get assigned clients with next_service_date within N days
- Calculate priority based on days_until_service
- Flag if draft report already exists
- Sort by next_service_date ASC

---

### 3. GET /api/pco/dashboard/recent-reports
**Purpose**: Recent activity and quick access to reports

**Query Parameters**:
- `limit` (default: 10)
- `status` (optional: draft, pending, approved, declined)

**Response Data**:
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": 123,
        "client_id": 1,
        "company_name": "ABC Restaurant",
        "report_type": "both",
        "service_date": "2025-10-13",
        "status": "pending",
        "created_at": "2025-10-13T10:30:00Z",
        "submitted_at": "2025-10-13T14:20:00Z",
        "has_admin_notes": false,
        "bait_stations_count": 5,
        "fumigation_areas_count": 3
      }
    ],
    "total_count": 45
  }
}
```

**Business Logic**:
- Get recent reports for authenticated PCO
- Order by created_at DESC
- Include quick stats (sub-module counts)
- Filter by status if provided

---

### 4. GET /api/pco/dashboard/declined-reports
**Purpose**: Reports requiring revision (declined by admin)

**Response Data**:
```json
{
  "success": true,
  "data": {
    "declined_reports": [
      {
        "id": 120,
        "client_id": 1,
        "company_name": "ABC Restaurant",
        "service_date": "2025-10-10",
        "declined_at": "2025-10-12T09:00:00Z",
        "admin_notes": "Please add missing bait station BS-005 and verify chemical quantities.",
        "reviewed_by_name": "Admin User",
        "days_since_declined": 2,
        "priority": "urgent"
      }
    ],
    "total_declined": 2
  }
}
```

**Business Logic**:
- Get reports with status='draft' AND admin_notes IS NOT NULL
- Calculate days_since_declined (reviewed_at to now)
- Priority: urgent (>3 days), high (2-3 days), normal (<2 days)
- Include admin feedback for quick reference

---

### 5. GET /api/pco/dashboard/statistics
**Purpose**: Detailed performance statistics and trends

**Query Parameters**:
- `period` (default: 30) - days to analyze

**Response Data**:
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "reports_submitted": 12,
    "reports_approved": 11,
    "reports_declined": 1,
    "approval_rate": 91.67,
    "average_turnaround_hours": 18.5,
    "clients_serviced": 8,
    "most_serviced_client": {
      "company_name": "ABC Restaurant",
      "report_count": 3
    },
    "report_types": {
      "bait_inspection": 4,
      "fumigation": 3,
      "both": 5
    },
    "monthly_trend": [
      {
        "month": "2025-10",
        "reports": 12,
        "approval_rate": 91.67
      }
    ]
  }
}
```

**Business Logic**:
- Aggregate statistics for specified period
- Calculate approval rate percentage
- Average turnaround time (submitted_at to reviewed_at)
- Breakdown by report type
- Monthly trend data for charts

---

### 6. GET /api/pco/dashboard/alerts (Optional)
**Purpose**: Important notifications and action items

**Response Data**:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "type": "declined_report",
        "priority": "high",
        "message": "Report for ABC Restaurant requires revision",
        "report_id": 120,
        "action_url": "/reports/120/edit"
      },
      {
        "type": "upcoming_service",
        "priority": "medium",
        "message": "XYZ Bakery service due in 2 days",
        "client_id": 5,
        "action_url": "/clients/5/create-report"
      }
    ],
    "unread_count": 2
  }
}
```

---

## Database Queries

### Summary Query
```sql
SELECT 
  (SELECT COUNT(*) FROM client_pco_assignments 
   WHERE pco_id = ? AND status = 'active') as assigned_clients,
  
  (SELECT COUNT(*) FROM reports 
   WHERE pco_id = ? AND status = 'pending') as pending_reports,
  
  (SELECT COUNT(*) FROM reports 
   WHERE pco_id = ? AND status = 'draft' AND admin_notes IS NOT NULL) as declined_reports,
  
  (SELECT COUNT(*) FROM reports 
   WHERE pco_id = ? AND status = 'draft' AND admin_notes IS NULL) as draft_reports,
  
  (SELECT COUNT(*) FROM reports 
   WHERE pco_id = ? AND status = 'approved') as total_approved
```

### Upcoming Assignments Query
```sql
SELECT 
  c.id, c.company_name, c.city,
  r_last.service_date as last_service_date,
  r_last.next_service_date,
  DATEDIFF(r_last.next_service_date, CURDATE()) as days_until_service,
  EXISTS(
    SELECT 1 FROM reports 
    WHERE client_id = c.id AND pco_id = ? AND status = 'draft'
  ) as has_draft
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
LEFT JOIN (
  SELECT client_id, service_date, next_service_date
  FROM reports
  WHERE status = 'approved'
  ORDER BY service_date DESC
  LIMIT 1
) r_last ON c.id = r_last.client_id
WHERE ca.pco_id = ? AND ca.status = 'active'
  AND r_last.next_service_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
ORDER BY days_until_service ASC
```

---

## Implementation Checklist

### Step 1: Create Controller
- [ ] Create `src/controllers/pcoDashboardController.ts`
- [ ] Implement getDashboardSummary
- [ ] Implement getUpcomingAssignments
- [ ] Implement getRecentReports
- [ ] Implement getDeclinedReports
- [ ] Implement getStatistics
- [ ] Add comprehensive error handling
- [ ] Add logging for all operations

### Step 2: Create Routes
- [ ] Create `src/routes/pcoDashboardRoutes.ts`
- [ ] Define all endpoint routes
- [ ] Apply authentication middleware (requireRole(['pco', 'both']))
- [ ] Apply validation middleware
- [ ] Integrate into main router

### Step 3: Validation Schemas
- [ ] Create `src/validators/pcoDashboardValidation.ts`
- [ ] Query parameter schemas (limit, days_ahead, period)
- [ ] Response validation (optional)

### Step 4: Testing
- [ ] Create `test-pco-dashboard.sh`
- [ ] Test summary endpoint
- [ ] Test upcoming assignments
- [ ] Test recent reports with filters
- [ ] Test declined reports
- [ ] Test statistics calculations
- [ ] Verify performance (<500ms)
- [ ] Test with multiple PCOs

### Step 5: Documentation
- [ ] Update backend-roadmap.md
- [ ] Add endpoint examples
- [ ] Document query parameters
- [ ] Add response schemas
- [ ] Create Postman collection

---

## Performance Considerations

1. **Caching Strategy**:
   - Summary data: 5-minute cache
   - Statistics: 15-minute cache
   - Recent reports: No cache (real-time)

2. **Query Optimization**:
   - Use indexed fields (pco_id, status, service_date)
   - Limit result sets appropriately
   - Use subqueries efficiently
   - Consider materialized views for statistics

3. **Response Size**:
   - Keep summary endpoint lightweight (<5KB)
   - Limit default result counts (10 items)
   - Use pagination for large datasets

---

## Business Rules

1. ✅ Only show data for authenticated PCO
2. ✅ Declined reports are drafts with admin_notes
3. ✅ Upcoming services based on next_service_date from last approved report
4. ✅ Priority calculation based on time sensitivity
5. ✅ Statistics calculated from actual report data
6. ✅ All counts and metrics real-time (no manual updates needed)

---

## Success Criteria

- [ ] All endpoints return correct data
- [ ] Performance <500ms for all queries
- [ ] Proper error handling for edge cases
- [ ] Comprehensive test coverage
- [ ] Mobile app can display dashboard properly
- [ ] Statistics calculations accurate
- [ ] Ready for Phase 4.2 (Sync functionality)

---

## Next: Phase 4.2 - PCO Sync & Offline Data

After completing Phase 4.1, we'll move to offline sync functionality which will use the dashboard endpoints as part of the data synchronization strategy.

---

**Ready to begin implementation!** 🚀

