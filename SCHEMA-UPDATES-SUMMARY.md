# Schema Updates Summary - Report Creation Enhancement

## Overview
Updated database schema and API endpoints to match the enhanced workflow specifications for report creation, particularly for bait station inspection and insect monitor tracking.

## Database Schema Changes

### 1. `bait_stations` Table

**New Fields Added:**
- `action_taken` ENUM('repaired', 'replaced', 'none') DEFAULT 'none'
  - Required when station condition is 'needs_repair', 'damaged', or 'missing'
  - Tracks what action PCO took to fix the issue

- `warning_sign_condition` ENUM('good', 'replaced', 'repaired', 'remounted') NOT NULL DEFAULT 'good'
  - Tracks condition and maintenance of warning signs on bait stations

**Modified Fields:**
- `bait_status` ENUM: Added 'old' option
  - Now: ('clean', 'eaten', 'wet', 'old')
  - Previously: ('clean', 'eaten', 'wet')

### 2. `insect_monitors` Table

**New Fields Added:**
- `monitor_condition` ENUM('good', 'replaced', 'repaired', 'other') NOT NULL DEFAULT 'good'
  - General condition of the monitor

- `monitor_condition_other` VARCHAR(255) NULL
  - Description when monitor_condition is 'other'

- `warning_sign_condition` ENUM('good', 'replaced', 'repaired', 'remounted') NOT NULL DEFAULT 'good'
  - Tracks warning sign condition on monitors

- `light_condition` ENUM('good', 'faulty', 'na') DEFAULT 'na'
  - Only applicable for fly_trap monitors
  - Tracks UV light condition

- `light_faulty_type` ENUM('starter', 'tube', 'cable', 'electricity', 'other', 'na') DEFAULT 'na'
  - Required when light_condition is 'faulty'
  - Identifies specific light failure type

- `light_faulty_other` VARCHAR(255) NULL
  - Description when light_faulty_type is 'other'

- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  - Added for tracking modifications

**Modified Fields:**
- `tubes_replaced` TINYINT(1) NULL
  - Now has proper comment: "Only for fly_trap monitors"

### 3. `reports` Table

**New Fields Added:**
- `recommendations` TEXT NULL
  - Admin-only field for adding recommendations to clients
  - Separate from admin_notes (internal) and general_remarks (PCO notes)

**Modified Fields (Documentation):**
- `general_remarks` TEXT NULL
  - Comment: "PCO remarks/notes about the service"
  - PCOs can only provide remarks, NOT recommendations

- `admin_notes` TEXT NULL
  - Comment: "Internal admin notes for PCO (decline reasons, etc.)"
  - For communication between admin and PCO

## API Validation Updates

### reportValidation.ts

**Bait Station Validation:**
```typescript
// Updated addBaitStationSchema
bait_status: 'clean' | 'eaten' | 'wet' | 'old'
action_taken: 'repaired' | 'replaced' | 'none' (required when station damaged)
warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted'
```

**Insect Monitor Validation:**
```typescript
// Updated addInsectMonitorSchema
monitor_condition: 'good' | 'replaced' | 'repaired' | 'other'
monitor_condition_other: string (required when condition is 'other')
warning_sign_condition: 'good' | 'replaced' | 'repaired' | 'remounted'
light_condition: 'good' | 'faulty' | 'na' (required for fly_trap)
light_faulty_type: 'starter' | 'tube' | 'cable' | 'electricity' | 'other' | 'na'
light_faulty_other: string (required when type is 'other')
```

**Report Validation:**
```typescript
// Updated approveReportSchema
admin_notes: string (optional)
recommendations: string (optional, max 5000 chars)
```

### syncValidation.ts

**Updated for Mobile Offline Sync:**
- Bait station validation aligned with new schema
- Insect monitor validation aligned with new schema
- All new fields included for offline pre-filling functionality

## Controller Updates

### reportController.ts

**Modified Functions:**

1. **addBaitStation()**
   - Added `action_taken` and `warning_sign_condition` to INSERT
   - Default values: action_taken='none', warning_sign_condition='good'

2. **updateBaitStation()**
   - Added new fields to allowedFields array
   - Supports partial updates of all new fields

3. **addInsectMonitor()**
   - Added all 7 new monitor fields to INSERT
   - Proper defaults: monitor_condition='good', light_condition='na', etc.

4. **updateInsectMonitor()**
   - Added new fields to allowedFields array
   - Supports partial updates of all monitor fields

5. **approveReport()**
   - Now accepts and stores `recommendations` field
   - Admin can add recommendations when approving reports

## Business Logic Changes

### Report Creation Workflow

**Screen 2A - Bait Station Inspection (Updated):**
```
Station Condition Assessment:
1. If station needs repair/damaged/missing:
   → MUST select action_taken (repaired/replaced)
   
2. Warning sign condition:
   → MUST specify: good/replaced/repaired/remounted

3. Bait status:
   → Now includes 'old' option (no poison, default)
```

**Screen 2B - Fumigation/Insect Monitors (Updated):**
```
Monitor Assessment:
1. Monitor Condition:
   → good/replaced/repaired/other
   → If 'other', must provide description

2. Warning Sign Condition:
   → good/replaced/repaired/remounted

3. For Fly Trap Monitors ONLY:
   → Light Condition: good/faulty
   → If faulty, specify type:
     - starter/tube/cable/electricity/other
   → If 'other', provide description
   
4. Standard Fields:
   → Glue board replaced: Yes/No
   → Tubes replaced: Yes/No (fly trap only)
   → Monitor serviced: Yes/No
```

### Admin Workflow

**Report Approval Process (Updated):**
```
Admin can now add:
1. admin_notes (internal, for PCO communication)
2. recommendations (for client, included in final report)

Field Separation:
- general_remarks: PCO's service notes
- admin_notes: Internal notes/decline reasons
- recommendations: Professional recommendations for client
```

## Data Integrity Rules

### Required Field Logic

**Bait Stations:**
- `action_taken` is required when `station_condition` IN ('needs_repair', 'damaged', 'missing')
- `warning_sign_condition` is always required
- `activity_other_description` required when `activity_other` = true

**Insect Monitors:**
- `monitor_condition_other` required when `monitor_condition` = 'other'
- `light_condition` required for monitor_type = 'fly_trap'
- `light_faulty_type` required when `light_condition` = 'faulty'
- `light_faulty_other` required when `light_faulty_type` = 'other'
- `tubes_replaced` only applicable for monitor_type = 'fly_trap'

## Migration Notes

### For Existing Data

**Bait Stations:**
- Existing records will have `action_taken` = 'none' (default)
- Existing records will have `warning_sign_condition` = 'good' (default)
- No data migration needed for `bait_status` ('old' is new option)

**Insect Monitors:**
- Existing records need defaults:
  - `monitor_condition` = 'good'
  - `warning_sign_condition` = 'good'
  - `light_condition` = 'na'
  - `light_faulty_type` = 'na'

**Reports:**
- Existing records will have `recommendations` = NULL
- Field is optional, no migration needed

### SQL Migration Script

```sql
-- Add new columns to bait_stations
ALTER TABLE bait_stations 
  ADD COLUMN action_taken ENUM('repaired', 'replaced', 'none') DEFAULT 'none' 
    COMMENT 'Action taken if station needs repair/damaged/missing' 
    AFTER station_condition,
  ADD COLUMN warning_sign_condition ENUM('good', 'replaced', 'repaired', 'remounted') 
    NOT NULL DEFAULT 'good' 
    AFTER action_taken,
  MODIFY bait_status ENUM('clean', 'eaten', 'wet', 'old') NOT NULL DEFAULT 'clean';

-- Add new columns to insect_monitors
ALTER TABLE insect_monitors
  ADD COLUMN monitor_condition ENUM('good', 'replaced', 'repaired', 'other') 
    NOT NULL DEFAULT 'good' 
    AFTER monitor_type,
  ADD COLUMN monitor_condition_other VARCHAR(255) NULL 
    COMMENT 'Description if monitor_condition is other' 
    AFTER monitor_condition,
  ADD COLUMN warning_sign_condition ENUM('good', 'replaced', 'repaired', 'remounted') 
    NOT NULL DEFAULT 'good' 
    AFTER monitor_condition_other,
  ADD COLUMN light_condition ENUM('good', 'faulty', 'na') DEFAULT 'na' 
    COMMENT 'Only for fly_trap monitors' 
    AFTER warning_sign_condition,
  ADD COLUMN light_faulty_type ENUM('starter', 'tube', 'cable', 'electricity', 'other', 'na') 
    DEFAULT 'na' 
    COMMENT 'If light is faulty' 
    AFTER light_condition,
  ADD COLUMN light_faulty_other VARCHAR(255) NULL 
    COMMENT 'Description if light_faulty_type is other' 
    AFTER light_faulty_type,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
    ON UPDATE CURRENT_TIMESTAMP 
    AFTER created_at,
  MODIFY tubes_replaced TINYINT(1) NULL 
    COMMENT 'Only for fly_trap monitors';

-- Add recommendations column to reports
ALTER TABLE reports
  ADD COLUMN recommendations TEXT NULL 
    COMMENT 'Admin-only recommendations for the client' 
    AFTER general_remarks,
  MODIFY general_remarks TEXT NULL 
    COMMENT 'PCO remarks/notes about the service',
  MODIFY admin_notes TEXT NULL 
    COMMENT 'Internal admin notes for PCO (decline reasons, etc.)';
```

## Testing Checklist

- [ ] Create bait station with damaged condition (verify action_taken required)
- [ ] Create bait station with 'old' bait status
- [ ] Update warning sign condition on existing station
- [ ] Create fly trap monitor with faulty light
- [ ] Verify light_faulty_type validation
- [ ] Create box monitor (verify light fields not required)
- [ ] Admin approve report with recommendations
- [ ] Verify recommendations appear in report output
- [ ] Test sync endpoint returns all new fields
- [ ] Verify mobile app can pre-fill from previous reports

## Affected Files

### Database
- `/guides/data.sql` - Updated table schemas

### Validation
- `/api/src/validation/reportValidation.ts` - Updated validation schemas
- `/api/src/validation/syncValidation.ts` - Updated sync validation

### Controllers
- `/api/src/controllers/reportController.ts` - Updated CRUD operations

## Breaking Changes

⚠️ **API Response Changes:**

**Bait Station Response:**
```json
{
  "station_number": "BS-001",
  "bait_status": "old",  // NEW VALUE POSSIBLE
  "action_taken": "repaired",  // NEW FIELD
  "warning_sign_condition": "good"  // NEW FIELD
}
```

**Insect Monitor Response:**
```json
{
  "monitor_type": "fly_trap",
  "monitor_condition": "good",  // NEW FIELD
  "warning_sign_condition": "good",  // NEW FIELD
  "light_condition": "faulty",  // NEW FIELD
  "light_faulty_type": "tube",  // NEW FIELD
  // ... existing fields
}
```

**Report Response:**
```json
{
  "general_remarks": "PCO notes here",
  "recommendations": "Admin recommendations here",  // NEW FIELD
  "admin_notes": "Internal notes here"
}
```

## Backwards Compatibility

✅ **Fully Compatible:**
- All new fields have DEFAULT values
- Optional fields in API (null allowed)
- Existing endpoints continue to work
- Mobile app can work without new fields (will use defaults)

⚠️ **Recommended Actions:**
- Update mobile app to support new fields
- Update PDF report generator to include recommendations
- Update admin UI to show recommendations field

---

**Implementation Date:** October 15, 2025  
**Phase:** 4.2 Enhancement  
**Status:** ✅ Complete
