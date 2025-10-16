# Phase 4.2: PCO Sync & Offline Data - Implementation Plan

**Phase**: 4.2  
**Status**: 🚧 In Progress  
**Priority**: 🔥 Critical for Mobile App  
**Target**: 6-7 endpoints for offline data synchronization

---

## Overview

The PCO mobile app must function offline with the ability to:
1. Download all necessary data for offline work
2. Create/edit reports without internet connection
3. Sync changes when back online
4. Export data for backup
5. Import data for restoration

**Key Constraint**: Maximum 10 reports per client for offline storage (per roadmap)

---

## Endpoints to Implement

### 1. GET /api/pco/sync/full
**Purpose**: Complete data sync for initial login or full refresh

**Returns**:
- Assigned clients (active assignments only)
- All active chemicals with usage types
- Last 10 reports per assigned client (for context/pre-fill)
- User profile information
- App version info

**Business Rules**:
- Only return data for current PCO
- Only active clients
- Only active chemicals
- Maximum 10 most recent reports per client
- Include client contacts for each client
- Exclude draft reports from other PCOs

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "name": "...", "pco_number": "..." },
    "clients": [
      {
        "id": 1,
        "company_name": "...",
        "address": "...",
        "contacts": [...]
      }
    ],
    "chemicals": [
      { "id": 1, "name": "...", "usage_type": "..." }
    ],
    "reports": [
      {
        "id": 1,
        "client_id": 1,
        "report_type": "both",
        "service_date": "2025-10-14",
        "status": "approved",
        "bait_stations": [...],
        "fumigation": {...},
        "insect_monitors": [...]
      }
    ]
  },
  "sync_timestamp": "2025-10-14T10:30:00Z",
  "counts": {
    "clients": 5,
    "chemicals": 20,
    "reports": 45
  }
}
```

---

### 2. GET /api/pco/sync/clients
**Purpose**: Incremental sync for client data only

**Query Parameters**:
- `since` (timestamp) - Only clients updated after this time
- `include_contacts` (boolean, default: true)

**Returns**: List of assigned clients with updates

**Business Rules**:
- Only active assignments
- Include assignment date for tracking
- Include client status

---

### 3. GET /api/pco/sync/chemicals
**Purpose**: Incremental sync for chemical data

**Query Parameters**:
- `since` (timestamp) - Only chemicals updated after this time

**Returns**: List of active chemicals

**Business Rules**:
- Only active chemicals
- All usage types
- Include safety information

---

### 4. GET /api/pco/sync/recent-reports
**Purpose**: Incremental sync for report updates

**Query Parameters**:
- `since` (timestamp) - Only reports updated after this time
- `client_id` (optional) - Filter by specific client

**Returns**: Updated reports with complete data

**Business Rules**:
- Only PCO's own reports
- Maximum 10 per client (oldest replaced)
- Include all sub-modules (bait stations, fumigation, monitors)
- Exclude other PCOs' draft reports

---

### 5. POST /api/pco/sync/upload
**Purpose**: Upload locally created/edited reports

**Request Body**:
```json
{
  "reports": [
    {
      "local_id": "temp-123",
      "client_id": 1,
      "report_type": "both",
      "service_date": "2025-10-14",
      "bait_stations": [...],
      "fumigation": {...},
      "insect_monitors": [...],
      "pco_signature_data": "...",
      "client_signature_data": "...",
      "client_signature_name": "..."
    }
  ]
}
```

**Returns**:
```json
{
  "success": true,
  "results": [
    {
      "local_id": "temp-123",
      "server_id": 456,
      "status": "created",
      "message": "Report created successfully"
    }
  ],
  "errors": []
}
```

**Business Rules**:
- Validate each report completely
- Create reports as drafts initially
- Return server IDs for local mapping
- Handle validation errors gracefully
- Support batch upload (multiple reports)
- Check for duplicates (client + service_date)

---

### 6. GET /api/pco/data/export
**Purpose**: Export complete offline dataset for backup

**Query Parameters**:
- `format` (json) - Future: pdf, csv support

**Returns**: Complete JSON export

**Business Rules**:
- Include all data from /sync/full
- Add export metadata (timestamp, version)
- Compress if > 1MB
- Maximum file size: 10MB

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "export_date": "2025-10-14T10:30:00Z",
    "app_version": "1.0.0",
    "pco": {...},
    "clients": [...],
    "chemicals": [...],
    "reports": [...],
    "metadata": {
      "total_clients": 5,
      "total_reports": 45,
      "total_chemicals": 20
    }
  }
}
```

---

### 7. POST /api/pco/data/import (Optional - Future Enhancement)
**Purpose**: Import previously exported data

**Request Body**: JSON export file

**Returns**: Import results with conflicts

**Business Rules**:
- Validate import structure
- Check for data conflicts
- Server data takes precedence
- Report conflicts to user
- Don't overwrite newer server data

---

## Database Queries Needed

### For Full Sync:
```sql
-- Get assigned clients
SELECT c.*, 
       GROUP_CONCAT(CONCAT(cc.contact_person, ':', cc.phone) SEPARATOR '|') as contacts
FROM clients c
JOIN client_pco_assignments cpa ON c.id = cpa.client_id
LEFT JOIN client_contacts cc ON c.id = cc.client_id
WHERE cpa.pco_id = ? AND cpa.status = 'active' AND c.status = 'active'
GROUP BY c.id;

-- Get active chemicals
SELECT * FROM chemicals WHERE status = 'active' ORDER BY name;

-- Get recent reports (10 per client)
SELECT r.*, 
       (SELECT JSON_ARRAYAGG(JSON_OBJECT(...)) FROM bait_stations WHERE report_id = r.id) as bait_stations,
       (SELECT JSON_OBJECT(...) FROM fumigation_areas WHERE report_id = r.id LIMIT 1) as fumigation,
       (SELECT JSON_ARRAYAGG(JSON_OBJECT(...)) FROM insect_monitors WHERE report_id = r.id) as insect_monitors
FROM (
  SELECT r.*, 
         ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY service_date DESC) as rn
  FROM reports r
  WHERE pco_id = ? AND status IN ('approved', 'pending', 'declined')
) r
WHERE rn <= 10;
```

---

## Validation Schemas

### Upload Report Schema:
```typescript
{
  local_id: Joi.string().required(),
  client_id: Joi.number().integer().positive().required(),
  report_type: Joi.string().valid('bait_inspection', 'fumigation', 'both').required(),
  service_date: Joi.date().max('now').required(),
  next_service_date: Joi.date().min(Joi.ref('service_date')).optional(),
  pco_signature_data: Joi.string().required(),
  client_signature_data: Joi.string().required(),
  client_signature_name: Joi.string().max(100).required(),
  general_remarks: Joi.string().max(1000).optional(),
  bait_stations: Joi.array().items(...).optional(),
  fumigation: Joi.object({...}).optional(),
  insect_monitors: Joi.array().items(...).optional()
}
```

---

## Error Handling

### Sync Errors:
- `SYNC_FAILED`: General sync failure
- `NO_ASSIGNMENTS`: PCO has no active clients
- `DATA_TOO_LARGE`: Export exceeds size limit
- `INVALID_TIMESTAMP`: Invalid 'since' parameter

### Upload Errors:
- `DUPLICATE_REPORT`: Report already exists for client/date
- `INVALID_CLIENT`: Client not assigned to PCO
- `VALIDATION_FAILED`: Report data validation failed
- `QUOTA_EXCEEDED`: Too many reports uploaded

---

## Performance Considerations

### Optimization:
1. **Pagination**: Large datasets split into chunks
2. **Compression**: Gzip responses > 1KB
3. **Caching**: Cache chemical list (15 min TTL)
4. **Indexing**: Ensure indexes on:
   - `reports(pco_id, service_date)`
   - `client_pco_assignments(pco_id, status)`
   - `chemicals(status)`

### Response Time Targets:
- Full sync: < 3 seconds
- Incremental sync: < 1 second
- Upload: < 2 seconds per report
- Export: < 5 seconds

---

## Testing Strategy

### Test Scenarios:

1. **Full Sync Tests**:
   - [ ] PCO with 0 clients
   - [ ] PCO with 5 clients
   - [ ] PCO with 10+ clients
   - [ ] Verify 10 report limit per client
   - [ ] Verify only active chemicals
   - [ ] Verify client contacts included

2. **Incremental Sync Tests**:
   - [ ] Sync with valid timestamp
   - [ ] Sync with future timestamp (no results)
   - [ ] Client assignment changes
   - [ ] Chemical updates

3. **Upload Tests**:
   - [ ] Upload single report
   - [ ] Upload multiple reports (batch)
   - [ ] Upload with validation errors
   - [ ] Duplicate report detection
   - [ ] Unassigned client rejection

4. **Export Tests**:
   - [ ] Export with small dataset
   - [ ] Export with maximum data
   - [ ] Export format validation
   - [ ] Export size limits

---

## Implementation Order

1. ✅ Planning document created
2. ⏳ Create sync controller (`pcoSyncController.ts`)
3. ⏳ Create sync routes (`pcoSyncRoutes.ts`)
4. ⏳ Create validation schemas
5. ⏳ Implement `/sync/full` endpoint
6. ⏳ Implement `/sync/clients` endpoint
7. ⏳ Implement `/sync/chemicals` endpoint
8. ⏳ Implement `/sync/recent-reports` endpoint
9. ⏳ Implement `/sync/upload` endpoint
10. ⏳ Implement `/data/export` endpoint
11. ⏳ Create comprehensive test script
12. ⏳ Run all tests and verify
13. ⏳ Update roadmap with results

---

## Success Criteria

- [ ] All 6-7 endpoints implemented
- [ ] 10 report limit enforced
- [ ] Full sync returns complete dataset
- [ ] Incremental sync works with timestamps
- [ ] Upload handles batches correctly
- [ ] Export generates valid backup
- [ ] All tests passing (target: 25-30 tests)
- [ ] Response times meet targets
- [ ] Documentation complete

---

**Next Step**: Create `pcoSyncController.ts` with the full sync endpoint
