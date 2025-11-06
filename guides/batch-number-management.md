# Chemical Batch Number Management

## Overview
The KPS system handles batch numbers in two distinct contexts to maintain historical accuracy while allowing chemicals to be updated with new batches.

## Two-Level Batch Number System

### 1. Current Batch Number (chemicals table)
```sql
chemicals
├── id
├── name
├── l_number          -- Registration/License number
├── batch_number      -- CURRENT batch in stock
└── ...
```

**Purpose**: Tracks the current batch number of chemical in inventory
**Usage**: 
- Displayed in chemical management interface
- Pre-fills when PCO creates new report
- Can be updated anytime when new batch arrives
- Does NOT affect historical reports

**Example**:
```
Chemical: Racumin Paste
L Number: L12345
Current Batch: BATCH2025-010  ← This can change when new stock arrives
```

### 2. Historical Batch Number (report tables)
```sql
station_chemicals              fumigation_chemicals
├── station_id                 ├── report_id
├── chemical_id                ├── chemical_id
├── quantity                   ├── quantity
└── batch_number               └── batch_number
    ↑                              ↑
    Historical record              Historical record
    Never changes                  Never changes
```

**Purpose**: Records the EXACT batch used during service
**Usage**:
- Captured when PCO submits report
- Stored permanently in report
- Retained even if chemical's current batch changes
- Ensures old reports remain accurate

## Workflow Example

### Scenario: Batch Change Over Time

**January 15, 2025** - PCO submits report
```
Chemical: Racumin Paste
Current Batch in System: BATCH2025-001
→ Report stores: BATCH2025-001
```

**February 1, 2025** - Admin updates chemical with new batch
```
Chemical: Racumin Paste
Current Batch Updated to: BATCH2025-010
→ Old reports still show: BATCH2025-001 ✓ (preserved)
```

**February 10, 2025** - PCO submits new report
```
Chemical: Racumin Paste
Current Batch in System: BATCH2025-010
→ New report stores: BATCH2025-010
```

**Result**: When printing old reports from January, they correctly show BATCH2025-001, maintaining compliance and traceability.

## Database Structure

### chemicals table
```sql
CREATE TABLE `chemicals` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `l_number` varchar(50) NULL,           -- Registration number
  `batch_number` varchar(100) NULL,       -- Current batch in stock
  `active_ingredients` text DEFAULT NULL,
  `usage_type` enum('bait_inspection','fumigation','multi_purpose') NOT NULL,
  `quantity_unit` varchar(20) NOT NULL,
  `safety_information` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
);
```

### station_chemicals table (bait inspections)
```sql
CREATE TABLE `station_chemicals` (
  `id` int(11) NOT NULL,
  `station_id` int(11) NOT NULL,
  `chemical_id` int(11) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,  -- Historical batch
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
);
```

### fumigation_chemicals table (SERVICE REPORT - FUMIGATIONs)
```sql
CREATE TABLE `fumigation_chemicals` (
  `id` int(11) NOT NULL,
  `report_id` int(11) NOT NULL,
  `chemical_id` int(11) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,  -- Historical batch
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
);
```

## API Behavior

### Creating a Chemical
```json
POST /api/admin/chemicals
{
  "name": "Racumin Paste",
  "l_number": "L12345",
  "batch_number": "BATCH2025-001",
  "active_ingredients": "Coumatetralyl 0.0375%",
  "usage_type": "bait_inspection",
  "quantity_unit": "grams"
}
```

### Updating Chemical (New Batch Arrives)
```json
PUT /api/admin/chemicals/123
{
  "batch_number": "BATCH2025-010"  // Only current batch changes
}
// Old reports remain unchanged ✓
```

### Creating Report (PCO Side)
```javascript
// System automatically uses current batch number
{
  chemicals: [
    {
      chemical_id: 123,
      quantity: 50,
      batch_number: "BATCH2025-010"  // From chemicals.batch_number
    }
  ]
}
// This batch_number is stored in station_chemicals/fumigation_chemicals
// and will NEVER change, even if chemicals.batch_number is updated later
```

## Compliance & Traceability

This two-level system ensures:

1. **Historical Accuracy**: Old reports show the actual batch used at time of service
2. **Regulatory Compliance**: Audit trail maintained for chemical usage
3. **Operational Efficiency**: PCOs see current batch when creating reports
4. **Data Integrity**: No risk of losing historical data when updating inventory

## Key Principles

✅ **Current Batch** (chemicals table): Can be updated anytime  
✅ **Historical Batch** (report tables): Immutable once report submitted  
✅ **L Number**: Registration/license number, rarely changes  
✅ **Batch Linking**: Each report links to exact batch used, preserved forever  

## Use Cases

### UC1: Regulatory Audit
Inspector requests all services performed with BATCH2025-001:
```sql
SELECT r.*, sc.batch_number 
FROM reports r
JOIN bait_stations bs ON bs.report_id = r.id
JOIN station_chemicals sc ON sc.station_id = bs.id
WHERE sc.batch_number = 'BATCH2025-001';
```
Result: Accurate list even if chemical currently has BATCH2025-010

### UC2: Product Recall
Manufacturer recalls BATCH2025-005:
```sql
SELECT DISTINCT r.client_id, r.service_date, c.name
FROM reports r
JOIN fumigation_chemicals fc ON fc.report_id = r.id
JOIN chemicals c ON c.id = fc.chemical_id
WHERE fc.batch_number = 'BATCH2025-005';
```
Result: Exact clients who received recalled batch

### UC3: Inventory Management
Check current inventory batch:
```sql
SELECT name, l_number, batch_number, quantity_unit
FROM chemicals
WHERE status = 'active';
```
Result: Current batch numbers for ordering new stock

## PCO Mobile App Behavior

### Pre-filling Logic
1. Load chemical list with current batch numbers
2. When PCO selects chemical, auto-fill current batch
3. PCO can override if using different batch
4. Submitted batch stored in report tables
5. System preserves batch number with report forever

### UI/UX
```
Chemical: Racumin Paste
Batch Number: [BATCH2025-010] ← Pre-filled from chemicals.batch_number
              (editable)        ← PCO can change if needed
```

## Migration Path

### Step 1: Add Columns
```sql
ALTER TABLE chemicals
ADD COLUMN l_number VARCHAR(50) NULL,
ADD COLUMN batch_number VARCHAR(100) NULL;
```

### Step 2: Existing Data (Optional)
```sql
-- If you have existing chemicals, you can:
UPDATE chemicals 
SET batch_number = 'BATCH2025-001'  -- Default batch for migration
WHERE batch_number IS NULL;
```

### Step 3: Update Code
- Frontend: Add l_number and batch_number fields to forms
- Backend: Handle new fields in create/update endpoints
- Mobile: Display and capture batch numbers in reports

## Notes

- L Number is optional (some chemicals may not require registration)
- Batch Number is optional (PCO can submit report without batch if not available)
- Historical batch numbers in reports are always preserved
- Current batch in chemicals table can be updated without affecting reports
- This design complies with GMP (Good Manufacturing Practice) traceability requirements

---

**Reference**: See workflow.md section on Chemical Management and Report Creation
**Migration Script**: `api/migrations/add-l-number-batch-number-to-chemicals.sql`
