# Phase 3 Planning - Advanced Features

## Current Status
✅ **Phase 2 Complete**: 32 endpoints (Version, User, Client, Chemical Management)
⚠️ **Phase 2.4 Testing**: Need to return and thoroughly test Chemical Management after Phase 3 work

---

## Phase 3 Overview

Phase 3 introduces more complex business logic and workflows. Two main components:

### 3.1 Assignment Management (Recommended Start)
**Complexity**: Medium
**Dependencies**: User Management (Phase 2.2), Client Management (Phase 2.3)
**Estimated Endpoints**: 5

**What it does**:
- Bulk assignment of PCOs to multiple clients
- Workload balancing algorithms
- Assignment statistics and reporting
- Enforces "one client = one active PCO" rule
- Assignment history tracking

**Why start here**:
1. Smaller scope than Reports
2. Builds on existing User/Client relationships
3. Will inform Report workflows (reports need PCO assignments)
4. Less complex than multi-step report creation
5. Can be tested independently

### 3.2 Report Management (Most Complex)
**Complexity**: High
**Dependencies**: All of Phase 2, Assignment Management helpful
**Estimated Endpoints**: 11+

**What it does**:
- Multi-step report creation (Draft → Pending → Approved/Declined)
- Bait Inspection reports (station management, pre-filling from previous)
- Fumigation reports (area tracking, pest management)
- Chemical usage tracking (integrates with Chemical Management)
- Digital signature capture and validation
- JSON import/export for offline work
- Report approval workflow (admin review)

**Why it's complex**:
1. Multiple report types with different requirements
2. Multi-step workflow with state management
3. Pre-filling logic from historical data
4. Chemical usage recording (report_chemicals table)
5. Digital signature handling
6. Import/export functionality
7. Approval workflow with email notifications

---

## Recommended Implementation Order

### Option 1: Sequential (Recommended)
```
Phase 3.1: Assignment Management
  ↓
Phase 3.2: Report Management
  ↓
Phase 3.3: Schedule Management
  ↓
Phase 3.4: Statistics & Dashboards
```

**Pros**: 
- Natural progression of complexity
- Each phase builds on previous
- Can test thoroughly after each component
- Reports benefit from completed assignments

**Cons**: 
- Reports come later (but will be more robust)

### Option 2: Jump to Reports
```
Phase 3.2: Report Management (skip 3.1 for now)
  ↓
Return to Phase 3.1: Assignment Management
```

**Pros**: 
- Get to core business functionality faster
- Can manually assign PCOs for testing

**Cons**: 
- Higher complexity first
- Missing bulk operations for assignments
- Will need to manually manage PCO-client relationships during testing

---

## Phase 3.1 Assignment Management - Detailed Breakdown

### Endpoints to Implement

1. **GET /api/admin/assignments**
   - List all PCO-Client assignments
   - Paginated, filterable by PCO or Client
   - Shows assignment history

2. **GET /api/admin/assignments/stats**
   - Assignment statistics
   - Workload per PCO (number of clients)
   - Unassigned clients count
   - Assignment distribution

3. **POST /api/admin/assignments/bulk-assign**
   - Assign multiple clients to a PCO
   - Or assign one client to multiple PCOs over time
   - Validates capacity and business rules

4. **POST /api/admin/assignments/bulk-unassign**
   - Unassign PCO from multiple clients
   - Handles reassignment logic
   - Maintains history

5. **GET /api/admin/assignments/workload-balance**
   - Suggests balanced assignments
   - Algorithm to distribute workload evenly
   - Considers geographic proximity (if location data available)

### Database Tables Involved
- `client_pco_assignments` (already exists from Phase 2.3)
- `users` (PCO list)
- `clients` (Client list)

### Business Rules
1. One client can only have ONE active PCO at a time
2. A PCO can have multiple clients
3. Assignment history is preserved (using date ranges)
4. When unassigning, must provide reason (optional)
5. Workload balancing considers current assignments

### Implementation Steps
1. Create AssignmentController
2. Add assignment routes
3. Implement bulk operations
4. Add workload balancing algorithm
5. Create validation middleware
6. Write comprehensive tests
7. Document API endpoints

---

## Phase 3.2 Report Management - Detailed Breakdown

### Endpoints to Implement

**Admin Endpoints** (6):
1. GET /api/admin/reports - List all reports with filtering
2. PUT /api/admin/reports/:id/status - Change report status
3. POST /api/admin/reports/:id/approve - Approve report
4. POST /api/admin/reports/:id/decline - Decline with reason
5. GET /api/admin/reports/pending - Get pending approval queue
6. GET /api/admin/reports/stats - Report statistics

**PCO Endpoints** (7):
7. POST /api/reports - Create new report (Draft)
8. GET /api/reports/:id - Get report details
9. PUT /api/reports/:id - Update report (if Draft)
10. GET /api/pco/reports - Get PCO's reports
11. GET /api/pco/reports/:id/pre-fill - Get pre-fill data from previous report
12. POST /api/reports/import - Import report from JSON
13. GET /api/reports/export - Export report to JSON

### Database Tables Needed
- `reports` (main report table - already exists in schema)
- `report_chemicals` (chemical usage per report)
- `bait_stations` (for bait inspection reports)
- `fumigation_areas` (for fumigation reports)
- `report_pests` (pest sightings tracking)

### Report Types
1. **Bait Inspection**
   - Multiple bait stations
   - Pre-fill from previous visit
   - Chemical usage per station
   - Pest activity tracking

2. **Fumigation**
   - Multiple areas/rooms
   - Chemical usage per area
   - Dosage calculations
   - Safety protocols

3. **Combined (Both)**
   - Has both bait stations and fumigation areas
   - More complex data structure

### Report Workflow States
```
Draft → Pending → Approved
                ↓
              Declined → Can be revised → Pending again
```

### Implementation Steps (Large!)
1. Create ReportController with basic CRUD
2. Implement report status workflow
3. Add bait station management
4. Add fumigation area management
5. Implement chemical tracking (report_chemicals)
6. Add pre-fill logic from historical data
7. Digital signature handling
8. Import/export JSON functionality
9. Approval/decline workflow
10. Email notifications (if applicable)
11. Create comprehensive validation
12. Write extensive test suite
13. Document all endpoints

---

## Recommendation

**Start with Phase 3.1 Assignment Management**

### Reasons:
1. ✅ Lower complexity - good warm-up for Phase 3
2. ✅ Shorter implementation time (1-2 sessions vs 3-5 for reports)
3. ✅ Builds on existing Phase 2 work
4. ✅ Can test thoroughly before tackling reports
5. ✅ Will understand business rules better for reports
6. ✅ Reports can benefit from completed assignment system
7. ✅ Natural progression of difficulty

### Next Steps:
1. Confirm Assignment Management as starting point
2. Review existing `client_pco_assignments` table schema
3. Design workload balancing algorithm
4. Create AssignmentController structure
5. Implement endpoints one by one
6. Test thoroughly
7. Then move to Report Management

---

## Alternative: If Time is Limited

If you want to see faster business value, we could:
1. Implement **basic report creation** first (just Draft state, no workflow)
2. Skip advanced features (pre-fill, import/export)
3. Add workflow and advanced features later

This would give you:
- PCOs can create reports
- Reports linked to clients and chemicals
- Basic report viewing
- Can enhance later

But this approach means coming back to add complexity, which can be messier than doing it right the first time.

---

## Your Decision Needed

**Option A**: Start Phase 3.1 Assignment Management (Recommended) ✅
**Option B**: Jump to Phase 3.2 Report Management (Core functionality faster)
**Option C**: Basic Reports first, then enhance later

What would you like to do?

---

**Remember**: We need to return to test Phase 2.4 Chemical Management thoroughly after Phase 3 work!
