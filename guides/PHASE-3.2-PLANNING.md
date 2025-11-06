# Phase 3.2: Report Management - Implementation Plan

**Status**: 🚧 In Progress  
**Complexity**: 🔥🔥🔥 Very High (Most Complex Module)  
**Priority**: Critical  
**Estimated Endpoints**: 22+

---

## Overview

Report Management is the **MOST COMPLEX** module in the KPS system. It involves:
- Multi-step report creation workflow (5 screens in mobile app)
- Sub-module management (Bait Stations, Fumigation Areas/Pests/Chemicals, Insect Monitors)
- Chemical usage tracking with inventory integration
- Pre-fill functionality from **last APPROVED** report for client
- Status workflow (Draft → Pending → Approved/Declined/Archived)
- **Auto-unassign PCO after report submission** (Critical business rule!)
- Role-based access (Admin vs PCO with different permissions)
- Offline sync support with import/export (JSON format)
- Dual digital signature handling (PCO + Client)
- Admin review workflow with decline reasons
- **Admin-only editing after submission** (PCO cannot edit pending/approved reports)

---

## Critical Business Rules from workflow.md

### Report Submission Rules ⚠️
1. **Auto-unassign PCO**: After report submission, PCO assignment is **automatically removed**
2. **Manual Reassignment Required**: Admin must manually reassign PCO for next service
3. **Draft Visibility**: Draft reports are **NOT visible to admin** (only PCO can see their own drafts)
4. **Editing Restrictions**: 
   - PCO can edit: **ONLY draft status**
   - Admin can edit: **ANY status**
5. **Status Transitions**:
   - Draft → Pending (PCO submits)
   - Pending → Approved (Admin only)
   - Pending → Declined (Admin only, **requires admin_notes**)
   - Declined → Draft (System reverts, **reassigns PCO to client**)

### Pre-fill Logic Rules ⚠️
1. **Source**: Pre-fill from **last APPROVED report** for **same client**
2. **Bait Stations**: Match by location + station_number, auto-populate previous data
3. **Fumigation**: Copy chemicals and target pests from last SERVICE REPORT - FUMIGATION
4. **Insect Monitors**: Copy monitor types from last report
5. **Visual Indicators**: Frontend shows pre-filled vs new data (different background color)

### Validation Rules ⚠️
1. **Service Date**: Cannot be future date
2. **Report Type**: Must have corresponding data:
   - `bait_inspection`: Requires at least 1 bait station
   - `fumigation`: Requires at least 1 area AND 1 target pest
   - `both`: Requires both bait stations AND fumigation data
3. **Signatures**:
   - PCO signature: Required for **draft saving** (can be updated)
   - Client signature: Required for **submission** (final step)
4. **Chemical Validation**: Must be active and type-appropriate:
   - Bait inspection: `usage_type IN ('bait_inspection', 'multi_purpose')`
   - Fumigation: `usage_type IN ('fumigation', 'multi_purpose')`
5. **Station Numbers**: Must be unique per location per report

### Notification Rules ⚠️
1. **Report Submitted**: Email to admin "[PCO Name] submitted report for [Client Name]"
2. **Report Declined**: Push notification to PCO "Report for [Client] requires revision"
3. **New Assignment**: Push notification to PCO "You've been assigned to [Client Name]"

---

## Database Schema (CORRECTED)

### Core Tables

#### reports

```sql
- id (PK)
- client_id (FK → clients)
- pco_id (FK → users)
- report_type (enum: 'bait_inspection', 'fumigation', 'both')
- service_date (date, cannot be future)
- next_service_date (date, nullable)
- status (enum: 'draft', 'pending', 'approved', 'declined', 'archived')
- pco_signature_data (text, base64)
- client_signature_data (text, base64)
- client_signature_name (varchar 100)
- general_remarks (text, nullable)
- admin_notes (text, nullable - used for decline reasons)
- created_at (timestamp, auto)
- updated_at (timestamp, auto)
- submitted_at (timestamp, nullable)
- reviewed_at (timestamp, nullable)
- reviewed_by (FK → users, nullable - admin who reviewed)
```

#### bait_stations
```sql
- id (PK)
- report_id (FK → reports)
- station_number (varchar)
- location (enum: 'inside', 'outside')
- is_accessible (boolean)
- inaccessible_reason (text)
- activity_detected (boolean)
- activity_droppings, activity_gnawing, activity_tracks, activity_other (boolean)
- activity_other_description (text)
- bait_status (enum: 'clean', 'eaten', 'wet')
- station_condition (enum: 'good', 'needs_repair', 'damaged', 'missing')
- rodent_box_replaced (boolean)
- station_remarks (text)
- created_at, updated_at
```

#### station_chemicals (join table)
```sql
- id (PK)
- station_id (FK → bait_stations)
- chemical_id (FK → chemicals)
- quantity_used (decimal)
- batch_number (varchar)
- created_at
```

#### fumigation_areas (join table)
```sql
- id (PK)
- report_id (FK → reports)
- area_name (enum: 'kitchen', 'storage_room', 'loading_dock', 'dining_area', etc.)
- created_at
```

#### fumigation_target_pests (join table)
```sql
- id (PK)
- report_id (FK → reports)
- pest_type (enum: 'cockroaches', 'ants', 'flies', 'moths', etc.)
- created_at
```

#### fumigation_chemicals (join table)
```sql
- id (PK)
- report_id (FK → reports)
- chemical_id (FK → chemicals)
- quantity_used (decimal)
- batch_number (varchar)
- created_at
```

#### insect_monitors

```sql
- id (PK)
- report_id (FK → reports)
- monitor_type (enum: 'box', 'fly_trap')
- glue_board_replaced (boolean, default 0)
- tubes_replaced (boolean, nullable - only for fly_trap)
- monitor_serviced (boolean, default 0)
- created_at (timestamp, auto)
```

**Note**: The database schema has monitor_type and service booleans, NOT location/pest_type/count. This is different from workflow.md screens but matches actual database.

---

## Business Rules

### Report Creation Rules
1. ✅ **PCO Assignment Required**: PCO must be actively assigned to client
2. ✅ **One Draft Rule**: Only one draft report per client-PCO pair at a time
3. ✅ **Service Date Validation**: Cannot be a future date
4. ✅ **Report Type Validation**: Must be 'bait_inspection', 'fumigation', or 'both'
5. ✅ **Signature Required**: PCO signature required to submit (not for draft)

### Bait Station Rules
1. ✅ **Unique Station Number**: Per location (inside/outside) within same report
2. ✅ **Accessibility Logic**: If not accessible, reason is required
3. ✅ **Activity Logic**: If activity detected, at least one type must be selected
4. ✅ **Chemical Validation**: All chemicals must be active and exist in system
5. ✅ **Pre-fill Logic**: Copy from last approved report for same client

### Fumigation Rules
1. ✅ **At Least One Area**: Must select at least one treatment area
2. ✅ **At Least One Pest**: Must select at least one target pest
3. ✅ **Chemical Validation**: All chemicals must be active and type-appropriate
4. ✅ **Pre-fill Logic**: Copy chemicals and pests from last SERVICE REPORT - FUMIGATION

### Status Workflow Rules
1. ✅ **Draft → Pending**: Submit action (validates all data complete)
2. ✅ **Pending → Approved**: Admin only, records approver and timestamp
3. ✅ **Pending → Declined**: Admin only, requires decline_reason
4. ✅ **No Editing After Submit**: Once status is 'pending', PCO cannot edit
5. ✅ **Approved Reports**: Immutable, cannot be deleted or modified

---

## API Endpoints

### Core Report Management

#### 1. POST /api/pco/reports
**Create new report (draft)**
- Verify PCO assignment to client
- Check for existing draft
- Create report with status='draft'
- Returns report ID

#### 2. GET /api/pco/reports
**List PCO's reports**
- Pagination (page, limit)
- Filter by client_id, status, date range
- Returns reports with client info

#### 3. GET /api/admin/reports
**List all reports (admin view)**
- Pagination (page, limit)
- Filter by pco_id, client_id, status, date range
- Returns reports with PCO and client info

#### 4. GET /api/reports/{id}
**Get full report details**
- Returns report with all sub-modules
- Role-based access (admin or report owner)
- Includes: bait stations, fumigation data, insect monitors

#### 5. PUT /api/pco/reports/{id}
**Update draft report**
- Only draft status allowed
- Update basic info (type, dates, remarks, signature)
- Verify PCO ownership

#### 6. DELETE /api/pco/reports/{id}
**Delete draft report**
- Only draft status allowed
- Cascade delete all sub-modules
- Verify PCO ownership

#### 7. POST /api/pco/reports/{id}/submit
**Submit report for approval**
- Change status: draft → pending
- Validate all required data complete
- Verify PCO ownership
- Trigger admin notification

### Admin Approval Workflow

#### 8. POST /api/admin/reports/{id}/approve
**Approve report**
- Change status: pending → approved
- Record admin ID and timestamp
- Verify admin role

#### 9. POST /api/admin/reports/{id}/decline
**Decline report with admin feedback**
- Change status: pending → declined
- **REQUIRED**: admin_notes field (decline reason, min 10 chars)
- Record admin ID (reviewed_by) and timestamp (reviewed_at)
- **CRITICAL**: Reassign PCO to client (reactivate assignment)
- Trigger PCO notification with admin_notes
- Admin notes visible to PCO for revision

#### 10. GET /api/admin/reports/pending
**Get pending reports**
- Quick access to reports needing approval
- Pagination support
- Returns count and list

### Bait Station Management

#### 11. POST /api/pco/reports/{id}/bait-stations
**Add bait station**
- Verify report is draft
- Check duplicate station number per location
- Create station with chemicals (nested)
- Return station ID

#### 12. PUT /api/pco/reports/bait-stations/{station_id}
**Update bait station**
- Verify report is draft
- Update station and chemicals
- Verify PCO ownership through report

#### 13. DELETE /api/pco/reports/bait-stations/{station_id}
**Delete bait station**
- Verify report is draft
- Cascade delete chemicals
- Verify PCO ownership

#### 14. GET /api/pco/reports/{id}/bait-stations
**List bait stations for report**
- Returns stations with chemicals
- Group by location (inside/outside)

### Fumigation Management

#### 15. PUT /api/pco/reports/{id}/fumigation
**Update fumigation data**
- Verify report is draft
- Update areas, pests, chemicals (all in one call)
- Replace existing data
- Verify PCO ownership

#### 16. GET /api/pco/reports/{id}/fumigation
**Get fumigation data**
- Returns areas, pests, chemicals
- Role-based access

### Insect Monitor Management

#### 17. POST /api/pco/reports/{id}/insect-monitors
**Add insect monitor**
- Verify report is draft
- Create monitor
- Return monitor ID

#### 18. PUT /api/pco/reports/insect-monitors/{monitor_id}
**Update insect monitor**
- Verify report is draft
- Update monitor data
- Verify PCO ownership

#### 19. DELETE /api/pco/reports/insect-monitors/{monitor_id}
**Delete insect monitor**
- Verify report is draft
- Verify PCO ownership

### Pre-fill & Offline Sync

#### 20. GET /api/pco/reports/pre-fill/{client_id}
**Get pre-fill data from last approved report for client**
- Find last APPROVED report for specified client
- Return bait stations (by location+number matching)
- Return fumigation areas, target pests, chemicals
- Return insect monitor types
- PCO can modify all pre-filled data before saving

#### 21. POST /api/pco/reports/import
**Import offline reports**
- Validate JSON structure
- Check for conflicts
- Bulk create/update reports
- Return success/error summary

#### 22. GET /api/pco/reports/export
**Export reports for offline work**
- Filter by date range
- Returns JSON with report data
- Includes assigned clients and chemicals

---

## Implementation Strategy

### Phase 1: Core Report CRUD (Endpoints 1-7)
**Priority**: 🔥 Critical
1. Create ReportController with basic CRUD
2. Implement status workflow validation
3. Create reportRoutes and reportValidation
4. Test core functionality

### Phase 2: Bait Station Module (Endpoints 11-14)
**Priority**: 🔥 High
1. Create BaitStationController
2. Implement chemical linking
3. Add validation for station rules
4. Test station management

### Phase 3: Fumigation & Monitors (Endpoints 15-19)
**Priority**: 🔥 High
1. Create FumigationController
2. Create InsectMonitorController
3. Implement area/pest validation
4. Test all sub-modules together

### Phase 4: Admin Workflow (Endpoints 8-10)
**Priority**: 🔥 Critical
1. Add admin approval/decline methods
2. Implement notification triggers
3. Add audit trail
4. Test status transitions

### Phase 5: Advanced Features (Endpoints 20-22)
**Priority**: ⚠️ Medium
1. Implement pre-fill logic
2. Build import/export functionality
3. Add conflict resolution
4. Test offline sync scenarios

---

## Validation Schemas (Joi)

### createReport
```javascript
{
  client_id: Joi.number().integer().positive().required(),
  report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both').required(),
  service_date: Joi.date().max('now').required(),
  next_service_date: Joi.date().greater(Joi.ref('service_date')).optional(),
  general_remarks: Joi.string().max(2000).optional(),
  pco_signature_data: Joi.string().max(100000).optional()
}
```

### updateReport
```javascript
{
  report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both').optional(),
  service_date: Joi.date().max('now').optional(),
  next_service_date: Joi.date().optional(),
  general_remarks: Joi.string().max(2000).optional(),
  pco_signature_data: Joi.string().max(100000).optional()
}
```

### createBaitStation
```javascript
{
  station_number: Joi.string().max(50).required(),
  location: Joi.string().valid('inside', 'outside').required(),
  is_accessible: Joi.boolean().required(),
  inaccessible_reason: Joi.string().max(500).when('is_accessible', {
    is: false,
    then: Joi.required()
  }),
  activity_detected: Joi.boolean().required(),
  activity_droppings: Joi.boolean().when('activity_detected', { is: true, then: Joi.optional() }),
  activity_gnawing: Joi.boolean().when('activity_detected', { is: true, then: Joi.optional() }),
  activity_tracks: Joi.boolean().when('activity_detected', { is: true, then: Joi.optional() }),
  activity_other: Joi.boolean().when('activity_detected', { is: true, then: Joi.optional() }),
  activity_other_description: Joi.string().max(500).when('activity_other', { is: true, then: Joi.required() }),
  bait_status: Joi.string().valid('clean', 'eaten', 'wet').default('clean'),
  station_condition: Joi.string().valid('good', 'needs_repair', 'damaged', 'missing').required(),
  rodent_box_replaced: Joi.boolean().required(),
  station_remarks: Joi.string().max(1000).optional(),
  chemicals: Joi.array().items({
    chemical_id: Joi.number().integer().positive().required(),
    quantity_used: Joi.number().positive().required(),
    batch_number: Joi.string().max(100).required()
  }).min(0).max(10)
}
```

### updateFumigation
```javascript
{
  areas: Joi.array().items(
    Joi.string().valid('kitchen', 'storage_room', 'loading_dock', 'dining_area', 
                      'prep_area', 'main_kitchen', 'dining_hall', 'bathroom', 
                      'office', 'warehouse', 'other')
  ).min(1).required(),
  target_pests: Joi.array().items(
    Joi.string().valid('cockroaches', 'ants', 'flies', 'moths', 'spiders', 
                      'beetles', 'termites', 'other')
  ).min(1).required(),
  chemicals: Joi.array().items({
    chemical_id: Joi.number().integer().positive().required(),
    quantity_used: Joi.number().positive().required(),
    batch_number: Joi.string().max(100).required()
  }).min(1).required()
}
```

### declineReport
```javascript
{
  admin_notes: Joi.string().min(10).max(1000).required()
    .messages({
      'string.min': 'Decline reason must be at least 10 characters',
      'any.required': 'Decline reason is required - PCO needs feedback'
    })
}
```

---

## Testing Strategy

### Test Categories (Target: 30+ tests)

1. **Authentication Tests** (3 tests)
   - Admin login
   - PCO login
   - Unauthorized access

2. **Core Report CRUD** (6 tests)
   - Create draft report
   - List reports (admin + PCO views)
   - Get report by ID
   - Update draft report
   - Delete draft report
   - Prevent duplicate drafts

3. **Status Workflow** (5 tests)
   - Submit report (draft → pending)
   - Approve report (admin)
   - Decline report with reason (admin)
   - Prevent editing submitted reports
   - Prevent PCO approval

4. **Bait Station Management** (5 tests)
   - Add bait station with chemicals
   - Update bait station
   - Delete bait station
   - Prevent duplicate station numbers
   - Validate chemical existence

5. **Fumigation Management** (3 tests)
   - Update fumigation data
   - Validate areas and pests
   - Validate chemical usage types

6. **Insect Monitor Management** (3 tests)
   - Add insect monitor
   - Update insect monitor
   - Delete insect monitor

7. **Pre-fill Functionality** (2 tests)
   - Get pre-fill data
   - Handle no previous reports

8. **Import/Export** (2 tests)
   - Export reports as JSON
   - Import offline reports

9. **Validation Tests** (5+ tests)
   - Invalid report type
   - Future service date
   - Missing required fields
   - Invalid status transitions
   - Invalid chemical IDs

---

## Dependencies

### Existing Systems
- ✅ **Authentication**: JWT tokens, role validation
- ✅ **User Management**: PCO user data
- ✅ **Client Management**: Client validation
- ✅ **Chemical Management**: Chemical existence and status
- ✅ **Assignment Management**: PCO-client assignment validation

### Required Integrations
- Chemical usage tracking (quantity validation)
- Assignment status checks (active assignments only)
- Notification system (approval/decline alerts)

---

## Success Criteria

- [ ] All 22 endpoints implemented and tested
- [ ] Status workflow prevents invalid transitions
- [ ] Sub-module management fully functional
- [ ] Pre-fill logic copies data correctly
- [ ] Import/export handles offline scenarios
- [ ] Role-based access enforced (admin vs PCO)
- [ ] All validation schemas comprehensive
- [ ] 30+ tests passing with 100% success rate
- [ ] Performance: < 500ms for complex queries
- [ ] Ready for frontend integration

---

## Next Steps

1. ✅ Review requirements and planning complete
2. ⏳ Create database schema verification queries
3. ⏳ Build ReportController with core CRUD methods
4. ⏳ Implement status workflow
5. ⏳ Build sub-module controllers
6. ⏳ Create comprehensive test suite

---

*This planning document guides Phase 3.2 implementation. Update status as we progress through each phase.*
