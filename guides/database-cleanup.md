# Database Cleanup - Draft Reports

## Overview
The KPS system automatically deletes draft reports older than 72 hours to maintain database hygiene and performance.

## How It Works

### Automatic Cleanup
- **Schedule**: Runs daily at 2:00 AM (Africa/Johannesburg timezone)
- **Target**: Draft reports created more than 72 hours ago
- **Action**: Permanent deletion from database
- **Logging**: All cleanup operations are logged with timestamp and count

### Why 72 Hours?
Draft reports are temporary work-in-progress documents. If a technician hasn't submitted a draft within 3 days, it's likely abandoned or no longer needed. This prevents:
- Database bloat from incomplete reports
- Confusion from old drafts
- Performance degradation over time

## Cron Job Details

**File**: `api/src/config/cron.ts`

**Schedule Pattern**: `0 2 * * *`
- Minute: 0
- Hour: 2 (2:00 AM)
- Day of Month: * (every day)
- Month: * (every month)
- Day of Week: * (every day of week)

**Timezone**: Africa/Johannesburg

## Cleanup Service

**File**: `api/src/services/cleanupService.ts`

### Functions:

1. **deleteOldDraftReports()**
   - Deletes all draft reports older than 72 hours
   - Returns: void (logs results)
   - Error handling: Catches and logs errors without crashing server

2. **getOldDraftReportsCount()**
   - Counts draft reports older than 72 hours
   - Returns: number
   - Used for monitoring and manual checks

### SQL Query:
```sql
DELETE FROM reports 
WHERE status = 'draft' 
AND created_at < DATE_SUB(NOW(), INTERVAL 72 HOUR)
```

## Manual Cleanup (Admin Only)

Administrators can manually trigger cleanup via API endpoints:

### Check Count of Old Drafts
```
GET /api/cleanup/draft-reports/count
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "message": "Found 5 draft report(s) older than 72 hours"
}
```

### Trigger Manual Cleanup
```
POST /api/cleanup/draft-reports/run
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed successfully. Check server logs for details."
}
```

## Logs

Cleanup operations are logged with:
- Start time
- Number of reports deleted
- Completion status
- Any errors encountered

**Example Logs:**
```
[INFO] === Cron Job: Draft Report Cleanup Started ===
[INFO] Starting cleanup: Deleting draft reports older than 72 hours...
[INFO] ✓ Cleanup successful: Deleted 3 draft report(s) older than 72 hours
[INFO] === Cron Job: Draft Report Cleanup Completed ===
```

**If no old drafts found:**
```
[INFO] ✓ Cleanup complete: No draft reports older than 72 hours found
```

## Server Startup

When the server starts:
1. Database connection is tested
2. Cron jobs are initialized
3. Cleanup scheduler is confirmed in logs

**Startup Log:**
```
[INFO] ⏰ Initializing scheduled tasks...
[INFO] ✓ Cron jobs initialized successfully
[INFO]   - Draft report cleanup: Daily at 2:00 AM (Africa/Johannesburg)
```

## Important Notes

### Reports Affected
- ✅ **Deleted**: Draft reports older than 72 hours
- ❌ **Not Deleted**: Pending, Approved, Declined, Emailed, or Archived reports
- ❌ **Not Deleted**: Draft reports less than 72 hours old

### Data Safety
- Only draft status reports are targeted
- Submitted reports (pending and beyond) are never deleted
- No cascade effects on other tables
- Complete audit trail in server logs

### Performance
- Runs during low-traffic hours (2:00 AM)
- Minimal database load
- Non-blocking operation
- Doesn't interrupt server operations

### Timezone Configuration
If you need to change the timezone, edit `api/src/config/cron.ts`:
```typescript
cron.schedule('0 2 * * *', async () => {
  // ... cleanup code
}, {
  timezone: "Your/Timezone" // Change this
});
```

## Testing

### Test in Development
You can manually trigger cleanup to test:

1. **Using API** (requires admin authentication):
   ```bash
   curl -X POST http://localhost:5000/api/cleanup/draft-reports/run \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Check before running**:
   ```bash
   curl -X GET http://localhost:5000/api/cleanup/draft-reports/count \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

### Verify Logs
Check server logs for cleanup confirmation:
- Server console output
- Log files (if configured)
- Monitor for any errors

## Customization

### Change Time Interval
To delete drafts older than a different duration, modify `cleanupService.ts`:

```typescript
// Change from 72 hours to 48 hours
const query = `
  DELETE FROM reports 
  WHERE status = 'draft' 
  AND created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)  -- Changed here
`;
```

### Change Schedule
To run at a different time, modify `cron.ts`:

```typescript
// Run at 3:00 AM instead of 2:00 AM
cron.schedule('0 3 * * *', async () => {
  // ... cleanup code
});

// Run every 12 hours
cron.schedule('0 */12 * * *', async () => {
  // ... cleanup code
});

// Run weekly on Sunday at 2:00 AM
cron.schedule('0 2 * * 0', async () => {
  // ... cleanup code
});
```

## Troubleshooting

### Cleanup Not Running
1. Check server logs for initialization message
2. Verify cron job is scheduled (check startup logs)
3. Ensure server timezone is correct
4. Test manual cleanup via API endpoint

### No Drafts Being Deleted
1. Check if any drafts exist older than 72 hours
2. Verify database connection
3. Review SQL query execution in logs
4. Check database permissions

### Errors in Logs
- Review error message details
- Check database connectivity
- Verify table structure hasn't changed
- Ensure proper permissions for DELETE operation

## Dependencies

- **node-cron**: `^3.0.3` - Cron job scheduling
- **@types/node-cron**: `^3.0.11` - TypeScript definitions

## Files Involved

1. **api/src/services/cleanupService.ts** - Cleanup logic
2. **api/src/config/cron.ts** - Cron scheduler
3. **api/src/routes/cleanupRoutes.ts** - Manual cleanup endpoints
4. **api/src/routes/index.ts** - Route registration
5. **api/src/server.ts** - Cron initialization

---

**Last Updated**: November 5, 2025  
**Version**: 1.0.0
