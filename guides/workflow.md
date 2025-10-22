# KPS - Pest Control Management System Workflow Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Authentication & User Management](#authentication--user-management)
3. [Admin Portal Workflows](#admin-portal-workflows)
4. [PCO Mobile App Workflows](#pco-mobile-app-workflows)
5. [Report Management Workflows](#report-management-workflows)
6. [Data Synchronization](#data-synchronization)
7. [Notification System](#notification-system)
8. [API Design Patterns](#api-design-patterns)

---

## System Overview

### Architecture
- **Admin Portal**: Next.js 14 with React.js and TypeScript (Web Application)
- **PCO Portal**: Next.js 14 with React.js and TypeScript (Web Application - Mobile Responsive)
- **Backend**: Node.js/Express RESTful API with TypeScript and pagination support
- **Database**: MySQL/MariaDB
- **Authentication**: JWT-based role access control (Admin/PCO)
- **Styling**: Tailwind CSS with custom focus styling

### Core Entities
- **Users** (Admin/PCO roles with authentication)
- **Clients** (Pest control service customers with contact information and expected equipment counts)
- **Chemicals** (Treatment products with L-numbers and batch tracking)
- **Reports** (Service documentation with status workflow and new equipment tracking)
- **Bait Stations** (Rodent inspection points with chemicals tracking and new addition flag)
- **Insect Monitors** (Light/box monitoring devices for flying insects with new addition flag)
- **Fumigation Areas** (Treatment zones with target pests and chemicals)
- **Notifications** (System alerts for assignments, report status changes)
- **Client Assignments** (PCO-to-client relationships and scheduling)
- **Station Chemicals** (Junction table linking bait stations to chemicals used)

---

## Authentication & User Management

### Login Process

#### Authentication Flow (Both Admin and PCO - Web Portal)
1. User enters login ID:
   - **Admin**: PCO number with "admin" prefix (e.g., "admin12345")
   - **PCO**: PCO number with "pco" prefix (e.g., "pco67890")
2. User enters password
3. System validates credentials:
   - Parses login ID format (admin/pco prefix)
   - Checks account lockout status (max failed attempts)
   - Verifies user exists and is active
   - Validates password hash using bcrypt
   - Records login attempt (success/failure)
4. On successful authentication:
   - Generate JWT token with session ID
   - Create user session with `role_context` (admin or pco based on login prefix)
   - Return user data with both `role` (actual user role) and `role_context` (login context)
   - Store token in localStorage (`kps_token`)
   - Store user info in localStorage (`kps_user`)
   - Store login timestamp
5. Redirect based on `role_context`:
   - **role_context = 'admin'**: Redirect to `/admin/dashboard`
   - **role_context = 'pco'**: Redirect to `/pco/dashboard`
   - Note: For users with role='both', the redirect is determined by login prefix (admin12345 → admin portal, pco12345 → pco portal)

#### Account Security Features
- **Account Lockout**: Temporary lock after multiple failed login attempts
- **Login Attempt Tracking**: All attempts logged with IP and user agent
- **Active Status Check**: Only active users can log in
- **Audit Logging**: All authentication events are logged

#### Dual Role Users (Tested & Confirmed)
- Users with `role="both"` can access both admin and pco portals with the same credentials
- The login prefix determines which portal they access:
  - Login with **admin**12345 → `role_context='admin'` → redirects to `/admin/dashboard`
  - Login with **pco**12345 → `role_context='pco'` → redirects to `/pco/dashboard`
- **No logout required** to switch portals - simply log in with different prefix
- Backend validates user has appropriate role before allowing login:
  - `admin` prefix requires: `role IN ('admin', 'both')`
  - `pco` prefix requires: `role IN ('pco', 'both')`
- **Data Fields**:
  - `user.role`: User's actual permissions (admin/pco/both) - stored in database
  - `user.role_context`: Current session context (admin or pco) - determined by login prefix
- **Frontend Implementation**: Must use `role_context` (not `role`) for redirect logic

**Example**: User with `pco_number='12345'` and `role='both'`:
```json
// Login with admin12345
{
  "user": {
    "pco_number": "12345",
    "role": "both",
    "role_context": "admin"
  }
}
// Redirects to /admin/dashboard

// Login with pco12345  
{
  "user": {
    "pco_number": "12345",
    "role": "both",
    "role_context": "pco"
  }
}
// Redirects to /pco/dashboard
```

### User Profile Management
- **PCOs can**:
  - View their profile information (name, email, phone, login ID)
  - **Change their password** via Profile page
  - View their service history
- **Admins can**:
  - Full CRUD operations on all users
  - Assign/manage user roles (admin/pco/both)
  - View user activity logs
  - View login attempt history
  - **Change their password** via Profile page (when implemented)

### Password Management

#### Password Security
- **Hashing Algorithm**: bcrypt with configurable salt rounds
- **Storage**: Only password hashes stored in database (never plain text)
- **Session Invalidation**: All other user sessions cleared on password change (current session remains active)
- **Audit Logging**: All password change attempts are logged with success/failure status

#### Password Requirements
All passwords must meet the following criteria:
- **Minimum Length**: 8 characters
- **Complexity**: Must contain:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)

**Validation**: Requirements enforced both client-side (immediate feedback) and server-side (security)

#### Change Password (Authenticated Users)
**Endpoint**: `POST /api/auth/change-password` (requires JWT token)

**Access Points**:
- **PCO Portal**: Profile page (`/pco/profile`)
- **Admin Portal**: Profile page (`/admin/profile`)

**User Flow**:
1. User navigates to Profile page
2. Click "Change Password" button in Security section
3. Expandable form reveals three password fields:
   - Current Password (with show/hide toggle)
   - New Password (with show/hide toggle)
   - Confirm New Password (with show/hide toggle)
4. User fills in all three fields
5. Click "Update Password" button

**Client-Side Validation** (Immediate Feedback):
- All fields required
- New passwords must match
- New password must be at least 8 characters
- New password must contain uppercase, lowercase, and number
- Shows validation errors before submission

**Server-Side Flow**:
1. Verify user is authenticated (JWT token)
2. Validate current password against stored hash
3. Validate new password meets complexity requirements
4. Hash new password using bcrypt
5. Update `password_hash` in database
6. Delete all other user sessions (force logout on other devices)
7. Keep current session active
8. Create audit log entry

**Success Response**:
- Success notification displayed
- Form resets and collapses
- User remains logged in on current device
- All other sessions invalidated

**Error Handling**:
- **Invalid current password**: "Current password is incorrect"
- **Weak new password**: Specific error message (e.g., "must contain uppercase letter")
- **Passwords don't match**: "New passwords do not match"
- **Server error**: "Failed to change password"

**Security Features**:
- Current password verification prevents unauthorized changes
- All other sessions invalidated to prevent session hijacking
- Complexity requirements prevent weak passwords
- Audit trail for compliance and troubleshooting

#### Forgot Password Flow
**Endpoint**: `POST /api/auth/forgot-password`

**Flow**:
1. User provides PCO number (without prefix)
2. System validates user exists and is active
3. Generate unique reset token (UUID)
4. Store token in `password_reset_tokens` table with 1-hour expiration
5. **Send password reset email** via SMTP (mail@kpspestcontrol.co.za)
6. For security: Always return success message (does not reveal if user exists)

**Email Template Includes**:
- Personalized greeting with user's name
- Clickable reset link (expires in 1 hour)
- Security warnings and best practices
- Professional HTML and plain text versions

#### Reset Password Flow
**Endpoint**: `POST /api/auth/reset-password`

**Flow**:
1. User clicks reset link from email (contains token)
2. User provides new password
3. System validates:
   - Token exists and not expired (< 1 hour old)
   - Token not already used
   - New password meets requirements
4. Update password hash
5. Mark token as used (`used_at` timestamp)
6. **Invalidate all user sessions** (force re-login on all devices)
7. User redirected to login page

**Security Features**:
- Tokens expire after 1 hour
- One-time use only (marked as used after reset)
- All active sessions terminated on reset
- Token validation prevents brute force

#### Verify Reset Token
**Endpoint**: `GET /api/auth/verify-reset-token?token={token}`

**Purpose**: Check if reset token is valid before showing password reset form

**Response**:
- Valid token: Returns user info (pco_number, name, email)
- Invalid/expired token: Returns error message

---

## Admin Portal Workflows

### Dashboard
**Key Metrics Displayed:**
- Total Clients (all statuses with growth percentage)
- Active PCO Users (count of active PCOs)
- Pending Reports (draft reports awaiting admin review - status remains 'draft')
- Completed Reports (approved reports for the month)

**Dashboard Sections:**
- **Recent Activity**: Displays recent system activity (last 24 hours)
- **Upcoming Assignments**: Shows upcoming service dates requiring attention

**Quick Actions:**
- New Client
- Add PCO
- Assignments
- View Reports

### User Management Workflow

#### Creating a User
1. Navigate to Users section
2. Click "Add New User"
3. Fill user details:
   - PCO Number
   - Name (required)
   - Email (required, must be unique, validated with email format)
   - Phone (optional)
   - Password (required, minimum 6 characters, admin provides initial password)
   - Role selection: Admin / PCO / Both
4. Submit to create user
5. **System Actions**:
   - Validates PCO number uniqueness (if provided)
   - Validates email uniqueness and format
   - Auto-generates PCO number if not provided
   - Hashes password using bcrypt (10 salt rounds)
   - Creates user with status 'active' by default
   - Logs user creation with admin ID
6. User can log in immediately with provided credentials
7. User can change their own password via Profile page

#### Editing a User
- Admin can edit: Name, Email, Phone, Role
- Email uniqueness validated (excluding current user)
- **Cannot edit**: PCO Number, Password (use separate password reset)
- Changes logged with admin ID

#### Password Reset (Admin Action)
- Admin can reset any user's password from user list
- New password provided by admin (minimum 6 characters)
- Password hashed with bcrypt before storage
- All user sessions invalidated (forces re-login on all devices)

#### User Deletion Logic
- **Soft Delete Only**: All user deletions are soft deletes (sets `deleted_at` timestamp and status to 'inactive')
- **Validation Checks**:
  - Cannot delete your own account
  - Cannot delete users with active client assignments (must unassign first)
- **Data Preservation**: User history, reports, and assignments remain in database for audit purposes
- **System Actions**: Logs deletion with admin ID and deleted user information

### Client Management Workflow

#### Creating a Client
1. Navigate to Clients section
2. Click "Add New Client"
3. Fill client details:
   - **Company Information**:
     - Company name (required)
     - Address Line 1 (required)
     - Address Line 2 (optional)
     - City, State, Postal Code (required)
   - **Expected Equipment Counts** (for new equipment tracking):
     - Total Bait Stations Inside: [number] (default: 0)
     - Total Bait Stations Outside: [number] (default: 0)
     - Total Insect Monitors Light (Fly Traps): [number] (default: 0)
     - Total Insect Monitors Box: [number] (default: 0)
     - **Note**: These counts are used to automatically detect newly added equipment
     - **Auto-Update**: System updates these values after each report submission to match actual equipment counts
   - **Contacts** (can add multiple):
     - Name, Role (Primary/Billing/Site Manager/Other)
     - Email, Phone
4. Save client (initially unassigned to any PCO)

#### Assigning PCO to Client
1. Navigate to Schedule page
2. Select a PCO from the left sidebar (shows PCO name, number, and current assignment count)
3. View assigned clients on the right side (or "No Assigned Clients" message)
4. Click "Assign Clients" button
5. In the modal:
   - Search for clients using the search box
   - View list showing all clients with status indicators:
     - Green dot = Already assigned (shows which PCO)
     - Gray dot = Unassigned (available to select)
   - Select one or multiple unassigned clients using checkboxes
   - Can unassign clients directly from modal using "Unassign" button
6. Click "Assign Selected" button
7. **System Actions**:
   - Bulk assignment records created with 'active' status
   - Clients immediately appear in selected PCO's schedule
   - Assignment count updates
   - Success notification displayed

#### Client Deletion Logic
- **Soft Delete Only**: All client deletions are soft deletes (sets `deleted_at` timestamp)
- **Data Preservation**: Client history and associated reports remain in database

### Chemical Management Workflow

#### Adding Chemicals
1. Navigate to Chemicals section
2. Click "Add New Chemical"
3. Fill chemical details:
   - Name (required, must be unique)
   - Active Ingredients (required)
   - Usage Type (required): Bait Inspection / Fumigation / Multi-purpose
   - Quantity Unit (required): ml, grams, kg, liters, etc.
   - L-Number (optional, auto-converted to uppercase)
   - Batch Number (optional, auto-converted to uppercase)
   - Safety Information (optional)
4. Submit to create chemical
5. **System Actions**:
   - Chemical created with status 'active' by default
   - L-Number and Batch Number normalized to uppercase
   - Validates for duplicate chemical names

#### Editing Chemicals
- Admin can edit all chemical details
- Chemical name uniqueness validated (excluding current chemical)
- L-Number and Batch Number auto-converted to uppercase
- Changes apply system-wide immediately
- Chemical history preserved in existing reports

#### Chemical Status Management
- Admin can toggle status between 'active' and 'inactive'
- Only active chemicals appear in report creation dropdowns
- Inactive chemicals remain in database for historical reports

#### Chemical Deletion Logic
- **Conditional Delete**: System automatically determines delete type
- **Soft Delete (Used in Reports)**:
  - If chemical is used in any station_chemicals OR fumigation_chemicals records
  - Sets `deleted_at` timestamp and status to 'inactive'
  - Preserves data for report integrity
  - Message: "Chemical has been deactivated"
- **Hard Delete (Not Used)**:
  - If chemical has zero usage in reports
  - Permanently removes from database
  - Message: "Chemical has been permanently deleted"
- **Validation**: System checks both bait station and fumigation usage before deletion

### Report Management Workflow

#### Report Status System
**Available Statuses:**
- **draft**: Reports being created or edited by PCO (includes submitted reports awaiting review)
- **approved**: Reports reviewed and approved by admin
- **declined**: Reports rejected by admin, requiring PCO revision
- **archived**: Completed reports removed from active workflow

#### Viewing All Reports
1. Navigate to Reports section (default shows "Draft" tab)
2. Filter reports by **Status Group** (tabs at top):
   - **Draft** (created by PCO, awaiting admin review) - *default view*
   - **Approved** (reviewed and approved reports)
   - **Emailed** (reports sent to clients)
   - **Archived** (completed reports not for client distribution)
   - **All Reports** (view all statuses)
3. **Search and Filters**:
   - **Search**: Client or PCO name
   - **Report Type Filter**: All Types, Bait Inspection, Fumigation, Both
   - **Date From/To**: Filter by service date range
4. Results displayed in table with pagination (25 per page)
5. **Status Badges**:
   - Draft: Yellow badge
   - Approved: Green badge
   - Declined: Red badge
   - Archived: Gray badge

#### Report Status Flow
```
Draft → Approved    (admin approves)
      → Declined    (admin declines with notes, PCO reassigned to client)
      → Archived    (admin archives)

Declined → Draft (PCO edits and resubmits)
```

**Critical Business Rules:**
- When PCO submits report, status remains 'draft'
- Reports stay in 'draft' status until admin takes action
- PCO is auto-unassigned from client when report is submitted
- PCO is reassigned to client when report is declined

#### Report Actions (per report)
Available actions vary by status:
- **View** (Eye icon): View full report details in modal
- **Edit** (Pencil icon): Navigate to `/admin/reports/{id}/edit` (available for all statuses)
- **Approve** (Green CheckCircle icon): Only visible when status = 'draft'
- **Decline** (Red XCircle icon): Only visible when status = 'draft'

#### Report Approval Process
1. Admin clicks **Approve** button on draft report
2. System validates report status (must be 'draft')
3. Modal displays:
   - Report ID and client name
   - Confirmation message
4. On confirm:
   - Report status changed to 'approved'
   - Optional: Admin can add notes and recommendations (not required)
   - `reviewed_by` and `reviewed_at` fields updated
   - **Notification sent to PCO**: "Report Approved - Your report for {client} has been approved"
   - Report can now be emailed to client

#### Report Decline Process
1. Admin clicks **Decline** button on draft report
2. System validates report status (must be 'draft')
3. Modal prompts for **Decline Notes** (required):
   - Minimum 10 characters
   - Purpose: Give PCO clear feedback for revision
4. On confirm:
   - Report status changed to 'declined'
   - Admin notes saved to `admin_notes` field
   - `reviewed_by` and `reviewed_at` fields updated
   - **PCO reassigned to client** (most recent inactive assignment set to 'active')
   - **Notification sent to PCO**: "Report Declined - Revision Required - Admin feedback: {notes}"
5. PCO can now edit and resubmit the report

#### Report Archive Process
1. Admin clicks **Archive** button (available in view modal or table)
2. System checks report is not already archived
3. Modal confirms archive action
4. On confirm:
   - Report status changed to 'archived'
   - `reviewed_by` and `reviewed_at` fields updated
   - **Notification sent to PCO**: "Report Archived - Your report for {client} has been archived"
5. Archived reports remain accessible but are separated from active workflow

#### Report View Modal
When viewing a report, modal displays:
- Report ID, type, status, service date
- Client details (company name, address, contact)
- PCO details (name, email, phone)
- Service details (based on report type):
  - **Bait Inspection**: Station count, station details
  - **Fumigation**: Area count, areas, target pests, chemicals used
- **Action Buttons**:
  - **Edit Report**: Navigate to edit page
  - **Download PDF**: Generate formatted PDF (functionality implemented)
  - **Email Client**: Send report to client (functionality implemented)
  - **Close**: Close modal

---

## PCO Mobile App Workflows

### Dashboard
**Display Elements:**
- Assigned clients count
- Draft reports count (reports in progress or awaiting admin review)
- Reports needing revision (declined reports)
- Quick access to create new report
- Service history summary

### Schedule Management

#### Viewing Assigned Clients
1. Navigate to Schedule
2. View list of assigned clients (name and address only for security)
3. **Client Status Handling**:
   - Active clients: Show normally
   - Inactive clients: Display "Client is currently inactive" message

#### Starting a New Report
1. Select client from schedule
2. System checks for previous reports and pre-loads data in background
3. System loads expected station count (from client profile)
4. Begin report creation workflow

**Equipment Tracking (Automatic Detection)**: 
- PCO can add equipment beyond the expected count (e.g., if client expects 5 inside stations, PCO can add 8)
- **System automatically detects and marks new equipment on report submission** (no manual confirmation needed)
- **Detection Logic**:
  - For **Bait Stations**: Compares actual count in report vs. client's expected count by location
    - Inside stations: If report has 5 but client expects 2, last 3 added are marked as new
    - Outside stations: If report has 3 but client expects 1, last 2 added are marked as new
  - For **Insect Monitors**: Compares actual count in report vs. client's expected count by monitor type
    - Fly Trap (Light) monitors: If report has 3 but client expects 1, last 2 added are marked as new
    - Box monitors: If report has 2 but client expects 1, last 1 added is marked as new
- **Tracking Process** (happens automatically when PCO submits report):
  1. System counts actual equipment in report by type/location
  2. Compares against client's expected counts (stored in client profile)
  3. Marks excess equipment with `is_new_addition = 1` flag (uses `ORDER BY id DESC` to mark most recently added)
  4. Updates report summary: `new_bait_stations_count` and `new_insect_monitors_count`
  5. Updates client's expected counts to match actual (for next visit)
- **Invoicing Benefits**:
  - New additions highlighted on report PDF for easy identification
  - Summary counts show total new equipment at a glance
  - No manual tracking needed - fully automated on submission
- **Client Profile Expected Counts**:
  - `total_bait_stations_inside`: Expected inside bait stations
  - `total_bait_stations_outside`: Expected outside bait stations
  - `total_insect_monitors_light`: Expected fly trap (light) monitors
  - `total_insect_monitors_box`: Expected box monitors
  - These values auto-update after each report submission to match actual counts

**Example Workflow**:
```
Initial Visit (Setup):
- Client profile set: 2 inside, 1 outside, 1 fly_trap, 1 box

First Report:
- PCO adds: 5 inside, 3 outside, 3 fly_trap, 2 box
- System marks as new: 3 inside, 2 outside, 2 fly_trap, 1 box
- Client expected updated to: 5 inside, 3 outside, 3 fly_trap, 2 box

Second Report (Next Visit):
- PCO adds: 5 inside, 3 outside, 3 fly_trap, 2 box
- System marks as new: 0 (all match expected)
- Client expected remains: 5 inside, 3 outside, 3 fly_trap, 2 box
```

**Missing Station Warning**: If PCO submits report with fewer stations than expected, app shows warning but allows submission if PCO chooses to proceed

### Report Creation Workflow

#### Screen 1: Report Setup
```
┌─────────────────────────────────┐
│ Report Type Selection           │
├─────────────────────────────────┤
│ ○ Bait Inspection               │
│ ○ Fumigation                    │
│ ○ Both                          │
├─────────────────────────────────┤
│ Service Date: [Today's Date]    │
│ (Cannot be future date)         │
├─────────────────────────────────┤
│ PCO Signature: [Digital Pad]    │
├─────────────────────────────────┤
│ [Continue] [Save Draft]         │
└─────────────────────────────────┘
```

#### Screen 2A: Bait Station Inspection
**Pre-filling Logic:**
- System loads last report data for this client
- When PCO adds station with same location + number, auto-populate previous data
- Visual indicators show pre-filled vs. new data (different background color/icon)

**Station Management:**
```
Location: [Inside/Outside]
Available Stations: [List with edit/delete options]
Missing Station Warning: If expected stations not inspected, show warning before submission

Add New Station:
┌─────────────────────────────────┐
│ Station Number: [___]           │
│ Station Accessible: [Yes/No]    │
│ ↳ If No: Reason: [_______]     │
│                                 │
│ Activity Detected: [Yes/No]     │
│ ↳ If Yes:                      │
│   ☐ Droppings ☐ Gnawing        │
│   ☐ Tracks ☐ Other: [____]     │
│                                 │
│ Bait Status:                    │
│ ○ Clean (default - no poison)   │
│ ○ Eaten ○ Wet ○ Old            │
│                                 │
│ Station Condition:              │
│ ○ Good ○ Needs Repair          │
│ ○ Damaged ○ Missing            │
│ ↳ If Needs Repair/Damaged/      │
│   Missing: Action Taken:        │
│   ○ Repaired ○ Replaced        │
│                                 │
│ Warning Sign Condition:         │
│ ○ Good ○ Replaced              │
│ ○ Repaired ○ Remounted         │
│                                 │
│ Chemicals Used: [+ Add]         │
│ [Chemical Name] [Qty] [Batch#]  │
│ (Batch# linked to this report) │
│                                 │
│ Station Remarks: [_______]      │
├─────────────────────────────────┤
│ [Save Station] [Cancel]         │
└─────────────────────────────────┘
```

#### Screen 2B: Fumigation
**Pre-filling Logic:**
- Load chemicals and monitors from last fumigation report
- Show pre-filled data with visual indicators

```
┌─────────────────────────────────┐
│ Areas Treated: (Multi-select)   │
│ ☐ Kitchen ☐ Storage Room       │
│ ☐ Loading Dock ☐ Dining Area   │
│ ☐ Prep Area ☐ Main Kitchen     │
│ ☐ Dining Hall ☐ Bathroom       │
│ ☐ Office ☐ Warehouse           │
│ ☐ Other: [____________]        │
├─────────────────────────────────┤
│ Target Pests: (Multi-select)    │
│ ☐ Cockroaches ☐ Ants ☐ Flies  │
│ ☐ Moths ☐ Spiders ☐ Beetles   │
│ ☐ Termites ☐ Other: [____]    │
├─────────────────────────────────┤
│ Chemicals Used: [+ Add]         │
│ [Chemical] [Qty] [Unit] [Batch] │
├─────────────────────────────────┤
│ Insect Monitors: [+ Add]        │
│ Monitor Type: [Box/Light (Fly Trap)] │
│                                 │
│ Monitor Condition:              │
│ ○ Good ○ Replaced              │
│ ○ Repaired ○ Other: [____]     │
│                                 │
│ Light Monitor (Fly Trap) Only:  │
│ Light Condition:                │
│ ○ Good ○ Faulty               │
│ ↳ If Faulty:                   │
│   ○ Starter ○ Tube ○ Cable    │
│   ○ Electricity ○ Other: [___] │
│ Glue Board Replaced: [Yes/No]   │
│ Tubes Replaced: [Yes/No]        │
│ (only if Fly Trap)               │
│                                 │
│ Warning Sign Condition:         │
│ ○ Good ○ Replaced              │
│ ○ Repaired ○ Remounted         │
│                                 │
│ Monitor Serviced: [Yes/No]      │
├─────────────────────────────────┤
│ General Remarks: [_______]      │
├─────────────────────────────────┤
│ [Continue] [Save Draft]         │
└─────────────────────────────────┘
```

#### Screen 3: Summary & Next Service
```
┌─────────────────────────────────┐
│ Report Summary                  │
├─────────────────────────────────┤
│ Service Date: [Date]            │
│ Report Type: [Type]             │
│ PCO: [Name]                     │
│                                 │
│ [Bait Stations Summary]         │
│ [Fumigation Summary]            │
│                                 │
│ Next Service Date: [Date Pick]  │
├─────────────────────────────────┤
│ [Edit Report] [Continue]        │
└─────────────────────────────────┘
```

#### Screen 4: Client Signature
```
┌─────────────────────────────────┐
│ Client Signature Required       │
├─────────────────────────────────┤
│ [Digital Signature Pad]         │
│                                 │
│ Client Name: [____________]     │
│                                 │
├─────────────────────────────────┤
│ [Clear] [Continue]              │
└─────────────────────────────────┘
```

#### Screen 5: Submit Report
```
┌─────────────────────────────────┐
│ Submit Report                   │
├─────────────────────────────────┤
│ ✓ All sections completed        │
│ ✓ Client signature obtained     │
│                                 │
│ [Submit Report]                 │
│ [Save as Draft]                 │
│ [Download as JSON]              │
│ (for offline backup)            │
└─────────────────────────────────┘
```

### Report Submission Process
1. **Online Submission**:
   - Submit directly to server
   - Show success confirmation
   - Auto-unassign PCO from client
   - Send notification to admin

2. **Offline Submission**:
   - Save report locally
   - Queue for submission when online
   - Allow JSON export as backup
   - Retry submission on next sync

### Report History & Revision
- View all submitted reports with status
- Access reports marked "Needs Revision" from dashboard
- View admin notes for declined reports
- Resubmit revised reports

---

## Report Management Workflows

### Report States & Transitions

```
                    PCO Creates Report
                           │
                           ▼
                    ┌─────────────┐
                    │    Draft    │◄─────────┐
                    │ (Editable)  │          │
                    └─────────────┘          │
                           │                 │
                    PCO Submits              │
                    (stays draft)            │
                           │                 │
                           ▼                 │ Admin Declines
                    ┌─────────────┐          │ (with notes)
                    │    Draft    │          │
                    │(Awaiting    │          │
                    │ Review)     │          │
                    └─────────────┘          │
                           │                 │
                    Admin Reviews            │
                           │                 │
                  ┌────────┼────────┐       │
                  ▼        ▼        ▼       │
            ┌──────────┐ ┌────────┐ ┌──────────┐
            │ Approved │ │ Archive│ │ Declined │──┘
            │(Final)   │ │        │ │          │
            └──────────┘ └────────┘ └──────────┘
```

### Status Descriptions
- **Draft**: Reports in creation or submitted and awaiting admin review (PCO can still edit)
- **Approved**: Final report, can be emailed to clients
- **Declined**: Returned to PCO with admin notes for revision
- **Archived**: Completed but not for client distribution

**Note**: System does NOT use 'pending' status. All submitted reports remain in 'draft' status until admin approval/decline.

---

## Equipment Tracking & Invoicing

### Overview
The system automatically tracks newly added bait stations and insect monitors for invoicing purposes. No manual confirmation required - detection happens automatically when PCO submits a report.

### Client Expected Equipment Counts
Each client profile maintains expected equipment counts:
- `total_bait_stations_inside`: Expected inside bait stations (default: 0)
- `total_bait_stations_outside`: Expected outside bait stations (default: 0)
- `total_insect_monitors_light`: Expected fly trap (light) monitors (default: 0)
- `total_insect_monitors_box`: Expected box monitors (default: 0)

**Purpose**: These baseline counts enable automatic detection of new equipment additions.

### Automatic Detection Process

#### When Detection Occurs
Equipment tracking runs automatically when PCO submits a report (status changes from draft to draft-awaiting-review).

#### Detection Logic

**For Bait Stations** (by location):
1. System counts actual inside stations in report
2. Compares to client's `total_bait_stations_inside`
3. If actual > expected:
   - Excess count = actual - expected
   - Mark the last N stations added as new (`is_new_addition = 1`)
   - Uses `ORDER BY id DESC LIMIT N` to identify most recently added
4. Repeat for outside stations

**For Insect Monitors** (by type):
1. System counts actual fly_trap monitors in report
2. Compares to client's `total_insect_monitors_light`
3. If actual > expected:
   - Excess count = actual - expected
   - Mark the last N monitors added as new (`is_new_addition = 1`)
   - Uses `ORDER BY id DESC LIMIT N` to identify most recently added
4. Repeat for box monitors

#### Database Fields

**Bait Stations Table**:
- `is_new_addition TINYINT(1) DEFAULT 0`: Flag indicating newly added station

**Insect Monitors Table**:
- `is_new_addition TINYINT(1) DEFAULT 0`: Flag indicating newly added monitor

**Reports Table**:
- `new_bait_stations_count INT(11) DEFAULT 0`: Total new bait stations (inside + outside)
- `new_insect_monitors_count INT(11) DEFAULT 0`: Total new insect monitors (fly_trap + box)

**Clients Table**:
- `total_bait_stations_inside INT(11) DEFAULT 0`: Expected inside stations
- `total_bait_stations_outside INT(11) DEFAULT 0`: Expected outside stations
- `total_insect_monitors_light INT(11) DEFAULT 0`: Expected fly trap monitors
- `total_insect_monitors_box INT(11) DEFAULT 0`: Expected box monitors

### Workflow Example

#### Initial Setup
```
Admin creates client with expected counts:
- Inside stations: 2
- Outside stations: 1
- Fly trap monitors: 1
- Box monitors: 1
```

#### First Service Visit
```
PCO adds equipment:
- 5 inside stations
- 3 outside stations
- 3 fly trap monitors
- 2 box monitors

PCO submits report → System processes:

1. Inside Stations: 5 actual vs 2 expected = 3 new
   - Marks stations #3, #4, #5 as is_new_addition = 1
   
2. Outside Stations: 3 actual vs 1 expected = 2 new
   - Marks stations #2, #3 as is_new_addition = 1
   
3. Fly Trap Monitors: 3 actual vs 1 expected = 2 new
   - Marks monitors #2, #3 as is_new_addition = 1
   
4. Box Monitors: 2 actual vs 1 expected = 1 new
   - Marks monitor #2 as is_new_addition = 1

5. Updates report summary:
   - new_bait_stations_count = 5 (3 inside + 2 outside)
   - new_insect_monitors_count = 3 (2 fly_trap + 1 box)

6. Updates client expected counts:
   - total_bait_stations_inside = 5
   - total_bait_stations_outside = 3
   - total_insect_monitors_light = 3
   - total_insect_monitors_box = 2
```

#### Second Service Visit (Next Month)
```
PCO adds same equipment:
- 5 inside stations
- 3 outside stations
- 3 fly trap monitors
- 2 box monitors

PCO submits report → System processes:

1. All counts match expected (5, 3, 3, 2)
2. No equipment marked as new (is_new_addition = 0 for all)
3. Report summary shows:
   - new_bait_stations_count = 0
   - new_insect_monitors_count = 0
4. Client expected counts unchanged
```

#### Third Visit - Client Expansion
```
Client adds new area, PCO installs more equipment:
- 7 inside stations (2 more)
- 3 outside stations (same)
- 5 fly trap monitors (2 more)
- 2 box monitors (same)

PCO submits report → System processes:

1. Inside Stations: 7 actual vs 5 expected = 2 new
   - Marks stations #6, #7 as is_new_addition = 1
   
2. Outside Stations: 3 actual vs 3 expected = 0 new
   
3. Fly Trap Monitors: 5 actual vs 3 expected = 2 new
   - Marks monitors #4, #5 as is_new_addition = 1
   
4. Box Monitors: 2 actual vs 2 expected = 0 new

5. Updates report summary:
   - new_bait_stations_count = 2
   - new_insect_monitors_count = 2

6. Updates client expected counts:
   - total_bait_stations_inside = 7
   - total_bait_stations_outside = 3
   - total_insect_monitors_light = 5
   - total_insect_monitors_box = 2
```

### Invoicing Benefits

**For Admin/Billing**:
- Instant visibility of new equipment additions
- Report summary shows totals at a glance
- Individual equipment flagged for detailed breakdown
- No manual counting or tracking required

**For PCO**:
- No extra steps or confirmations needed
- Just add equipment and submit as normal
- System handles all detection automatically

**For Client Invoicing**:
- Clear differentiation between regular service and new installations
- New equipment highlighted on PDF reports
- Accurate tracking for billing purposes
- Historical data preserved for auditing

### Technical Implementation

**Backend Functions** (`api/src/utils/equipmentTracking.ts`):
- `markNewBaitStations(reportId, clientId, location)`: Identifies and marks new bait stations
- `markNewInsectMonitors(reportId, clientId, monitorType)`: Identifies and marks new monitors
- `updateClientExpectedCounts(reportId, clientId)`: Updates client baseline counts
- `countNewBaitStations(reportId)`: Counts total new bait stations
- `countNewInsectMonitors(reportId)`: Counts total new monitors
- `updateReportNewEquipmentCounts(reportId)`: Updates report summary counts

**Integration Point** (`reportController.ts` → `submitReport()`):
```typescript
// After report submission validation
await markNewBaitStations(reportId, clientId, 'inside');
await markNewBaitStations(reportId, clientId, 'outside');
await markNewInsectMonitors(reportId, clientId, 'fly_trap');
await markNewInsectMonitors(reportId, clientId, 'box');

await updateReportNewEquipmentCounts(reportId);
await updateClientExpectedCounts(reportId, clientId);
```

**Database Migration**: `api/migrations/add_new_equipment_tracking.sql`

---

## Data Synchronization

### PCO App Sync Strategy

#### Login Sync (Full Sync)
1. **Download Priority Data**:
   - Assigned clients (current assignments only)
   - All active chemicals with usage types
   - Last 3 reports per assigned client (for pre-filling)
   - User profile information

#### Background Sync (When Online)
1. **Upload Priority**:
   - Draft report submissions (newly submitted reports awaiting review)
   - Draft reports (backup)
   - User profile changes

2. **Download Updates**:
   - New client assignments
   - Chemical updates
   - Report status changes
   - Admin messages/notifications

#### Conflict Resolution
- **Client Data**: Server version takes precedence
- **Chemical Data**: Server version takes precedence  
- **Report Data**: PCO local changes preserved, show warning if conflicts
- **User Profile**: Merge changes, prioritize most recent

#### Offline Capabilities
- Complete report creation and editing
- Access to synced client and chemical data
- Local storage of draft reports
- Queue submissions for when online

---

## Notification System

### Push Notifications (PCO Mobile App)
- **New Client Assignment**: "You've been assigned to [Client Name]"
- **Report Declined**: "Report for [Client] requires revision"
- **System Updates**: "New chemicals available" / "App update available"

### Email Notifications (Admin)
- **New Report Submitted**: "[PCO Name] submitted report for [Client Name]"
- **Upcoming Services**: "Services scheduled for tomorrow require PCO assignment"
- **System Alerts**: User account issues, sync failures

### In-App Notifications
- **Both Platforms**: Status updates, system messages
- **Real-time Updates**: New assignments, report status changes

---

## API Design Patterns

### Pagination Standard
- **Page Size**: 25 records per page
- **Response Format**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalRecords": 150,
    "totalPages": 6,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Search Endpoints
Each entity requires separate search endpoints for flexible querying:

#### Reports Search
- **Endpoint**: `/api/reports/search`
- **Searchable Fields**: 
  - Client name, PCO name, report type
  - Service date range, submission date range
  - Status, chemical used, target pests
  - Station numbers, areas treated
  - Free text in remarks/notes

#### Users Search
- **Endpoint**: `/api/users/search`
- **Searchable Fields**: PCO number, name, email, role, status

#### Clients Search
- **Endpoint**: `/api/clients/search`
- **Searchable Fields**: Company name, contact name, address, phone, email

#### Chemicals Search
- **Endpoint**: `/api/chemicals/search`
- **Searchable Fields**: Name, active ingredients, usage type, status

### Data Validation Rules

#### Report Validation
- Service date cannot be in the future
- At least one bait station OR fumigation data required
- Client signature required for submission
- Chemical quantities must be positive numbers
- Station numbers must be unique per location per report

#### User Validation
- PCO numbers must be unique across system
- Email addresses must be unique
- Role assignments must be valid (Admin/PCO)

#### Client Validation  
- At least one contact required
- Contact emails must be unique within client
- Address fields required for service location

---

## Business Rules Summary

### Assignment Rules
- One client can only be assigned to one PCO at a time
- PCO assignment automatically removed after report submission
- Admin must manually reassign for next service

### Deletion Rules
- **Hard Delete**: Only if no associated reports exist
- **Soft Delete**: When reports exist (preserve data integrity)
- **Chemical Deactivation**: When linked to reports (cannot delete)

### Report Rules
- Reports can only be created for assigned clients
- Reports cannot be edited after submission (PCO side)
- Only admins can edit reports in any status
- Next service date creates notification for admin
- **Recommendations**: Only admins can add recommendations to reports
- **PCO Input**: PCOs can only provide remarks/notes, not recommendations

### Data Integrity Rules
- All foreign key relationships maintained
- Audit trails for all critical operations
- Soft deletes preserve historical data
- Chemical usage tracking for compliance
- **Batch Number Linking**: Each chemical batch number is linked to the specific report where it was used, ensuring historical accuracy when old reports are printed

---

## Technical Requirements Summary

### Performance Requirements
- **API Response Time**: < 500ms for standard queries
- **Mobile App**: Smooth 60fps animations
- **Offline Mode**: Full functionality without internet
- **Sync Time**: < 30 seconds for complete data sync

### Security Requirements
- **Authentication**: JWT tokens with role-based access
- **Data Protection**: Encrypt sensitive client information
- **Audit Logging**: Track all admin actions
- **Mobile Security**: Secure local storage for offline data

### Quality Assurance
- **Clean Code**: Comprehensive documentation and comments
- **Testing**: Unit tests for all business logic
- **UX Priority**: Intuitive workflows, minimal clicks
- **Rock Solid Backend**: Error handling, validation, monitoring

---

*This workflow documentation serves as the complete specification for the KPS Pest Control Management System. All features described should be implemented with high attention to detail, prioritizing user experience and system reliability.*