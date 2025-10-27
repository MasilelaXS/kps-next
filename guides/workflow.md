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

**Purpose**: Assign clients to PCOs for service visits.

**How to Access**:
1. Navigate to the Schedule page from the admin menu

**The Schedule Interface**:
- **Left Sidebar**: List of all PCOs
  - Shows PCO name, number, and how many clients they're assigned to
- **Right Panel**: Shows the selected PCO's assigned clients
  - If no clients assigned, you'll see "No Assigned Clients" message

**Assigning Clients**:
1. Click on a PCO from the left sidebar
2. Click the "Assign Clients" button
3. In the assignment modal:
   - **Search Box**: Type to find specific clients quickly
   - **Client List**: Shows all clients with status indicators
     - 🟢 Green dot = Already assigned to a PCO (shows which one)
     - ⚪ Gray dot = Unassigned and available to select
   - **Checkboxes**: Select one or multiple unassigned clients
4. Click "Assign Selected" button
5. **What Happens**:
   - Selected clients immediately appear in the PCO's schedule
   - Assignment count updates
   - PCO can now see these clients in their portal
   - Success notification confirms the assignment

**Unassigning Clients**:
- Click the "Unassign" button next to any assigned client
- Client is immediately removed from PCO's schedule
- Note: PCOs are automatically unassigned after submitting a report

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
- **draft**: Reports being created or edited by PCO (includes submitted reports awaiting admin review)
- **pending**: Alternative status for submitted reports (functionally same as draft)
- **approved**: Reports reviewed and approved by admin
- **declined**: Reports rejected by admin, requiring PCO revision
- **emailed**: Reports that have been sent to clients via email
- **archived**: Completed reports removed from active workflow

#### Viewing All Reports
1. Navigate to Reports section (default shows "Draft / Pending" tab)
2. Filter reports by **Status Group** (5 tabs at top):
   - **Draft / Pending** (reports awaiting admin review - includes both 'draft' and 'pending' statuses) - *default view*
   - **Approved** (reviewed and approved reports only)
   - **Emailed** (reports that have been sent to clients via email)
   - **Archived** (completed reports removed from active workflow)
   - **All Reports** (view all statuses including declined reports)
3. **Search and Filters**:
   - **Search**: Client or PCO name
   - **Report Type Filter**: All Types, Bait Inspection, Fumigation, Both
   - **Date From/To**: Filter by service date range
4. Results displayed in table with pagination (25 per page)
5. **Status Badges**:
   - Draft/Pending: Yellow badge
   - Approved: Green badge
   - Declined: Red badge
   - Archived: Gray badge
   - Emailed: Blue badge (if implemented)

#### Report Status Flow
```
Draft/Pending → Approved    (admin approves)
              → Declined    (admin declines with notes, PCO reassigned to client)
              → Archived    (admin archives)

Approved → Emailed    (admin sends report to client via email)

Declined → Draft/Pending (PCO edits and resubmits)
```

**Critical Business Rules:**
- When PCO submits report, status remains 'draft' (or 'pending')
- Reports stay in 'draft'/'pending' status until admin takes action
- PCO is auto-unassigned from client when report is submitted
- PCO is reassigned to client when report is declined
- Declined reports appear in "All Reports" tab (not in Draft/Pending tab)

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

When you log in to the PCO portal, your dashboard shows:

**At a Glance**:
- **Assigned Clients**: How many clients you're currently assigned to service
- **Draft Reports**: Reports you've started or submitted that are awaiting admin review
- **Needs Revision**: Reports that admin declined and need your attention

**Quick Actions**:
- **Create New Report**: Jump straight to creating a report for an assigned client
- **View Schedule**: See all your assigned clients
- **View Service History**: Check your past completed reports

**What You Can Do**:
- Click on any metric to see the full list
- Access your most recent activity
- Navigate to any section using the menu

### Schedule Management

#### Viewing Your Assigned Clients

**How to Access**:
1. Click "Schedule" from the main menu
2. See a list of all clients assigned to you

**What You'll See**:
- Client company name
- Service address (for navigation)
- Client status

**Important Notes**:
- Only clients assigned to you by admin appear here
- If a client shows "Client is currently inactive", contact admin before visiting
- After you submit a report, you're automatically unassigned (admin will reassign for next service)

#### Starting a New Report

**Steps**:
1. From your Schedule, click on a client
2. Click "Create New Report" button
3. The system automatically:
   - Loads information from your last visit (if any)
   - Retrieves the client's expected equipment counts
   - Prepares pre-filled data to save you time

**What Happens Next**:
You'll be guided through the report creation screens (explained in the next section)

**About Adding Equipment**:
- You can add as much equipment as needed during the service visit
- If you add more equipment than the client normally has, the system will ask you to confirm
- The system automatically tracks new additions for invoicing
- Don't worry - you can't mess it up! The system has safety checks built in

### Report Creation Workflow

Creating a report is a simple 5-step process. The system guides you through each screen and saves your progress automatically.

#### Step 1: Report Setup

**What You'll Do**:
1. **Choose Report Type**:
   - Bait Inspection only
   - Fumigation only
   - Both (if doing both services)

2. **Confirm Service Date**:
   - Defaults to today's date
   - You cannot select a future date

3. **Add Your Signature**:
   - Use the digital signature pad to sign
   - This confirms you performed the service

**Navigation**:
- Click "Continue" to move to the next step
- Click "Save Draft" to save and finish later

---

#### Step 2A: Bait Station Inspection (if selected)

**Smart Pre-filling**:
- The system automatically loads data from your last visit to this client
- Stations with the same location and number get pre-filled with previous data
- Pre-filled data is highlighted so you know what's carried over
- You can edit any pre-filled information

**Adding Stations**:

Choose location first: **Inside** or **Outside**

For each station, you'll record:

1. **Station Number**: Your identification number for this station

2. **Accessibility**:
   - Was the station accessible?
   - If No: Briefly explain why

3. **Activity Check**:
   - Any signs of rodent activity?
   - If Yes: Select what you found (Droppings, Gnawing, Tracks, or Other)

4. **Bait Status**:
   - Clean (no poison used - default)
   - Eaten
   - Wet
   - Old

5. **Station Condition**:
   - Good
   - Needs Repair
   - Damaged
   - Missing
   - If not "Good": Select action taken (Repaired or Replaced)

6. **Warning Sign**:
   - Good
   - Replaced
   - Repaired
   - Remounted

7. **Chemicals Used** (if any):
   - Click "+ Add" to add chemicals
   - Enter chemical name, quantity, and batch number
   - You can add multiple chemicals per station

8. **Station Remarks** (optional):
   - Add any additional notes about this station

**Managing Your Stations**:
- Click "Save Station" to add it to your report
- View all added stations in the list
- Edit or delete stations as needed
- **Missing Station Alert**: If you submit with fewer stations than expected, you'll get a warning (but you can still proceed if needed)

**When Done**:
- Click "Continue" to proceed
- If you added more stations than expected, you'll get a confirmation message asking if you want to update the client's baseline count

---

#### Step 2B: Fumigation (if selected)

**Smart Pre-filling**:
- Chemicals and monitors from your last fumigation are pre-loaded
- Pre-filled data is highlighted for easy identification
- Edit anything that changed

**Fumigation Details**:

1. **Areas Treated** (select all that apply):
   - Kitchen, Storage Room, Loading Dock, Dining Area
   - Prep Area, Main Kitchen, Dining Hall, Bathroom
   - Office, Warehouse
   - Other (specify)

2. **Target Pests** (select all that apply):
   - Cockroaches, Ants, Flies, Moths
   - Spiders, Beetles, Termites
   - Other (specify)

3. **Chemicals Used**:
   - Click "+ Add Chemical"
   - Select chemical, enter quantity, unit, and batch number
   - Add as many chemicals as used

4. **Insect Monitors**:
   - Click "+ Add Monitor"
   - Choose type: Box or Light (Fly Trap)
   
   For each monitor, record:
   - **Monitor Condition**: Good, Replaced, Repaired, or Other
   - **Warning Sign**: Good, Replaced, Repaired, or Remounted
   - **Monitor Serviced**: Yes or No
   
   **For Light Monitors (Fly Traps) Only**:
   - **Light Condition**: Good or Faulty
   - If Faulty: What's wrong? (Starter, Tube, Cable, Electricity, Other)
   - **Glue Board Replaced**: Yes or No
   - **Tubes Replaced**: Yes or No

5. **General Remarks** (optional):
   - Add any overall notes about the fumigation

**When Done**:
- Click "Continue" to proceed
- If you added more monitors than expected, you'll get a confirmation message

---

#### Step 3: Review Summary & Schedule Next Service

**What You'll See**:
- Service date
- Report type
- Your name
- Summary of bait stations (if applicable)
- Summary of fumigation (if applicable)

**Set Next Service Date**:
- Pick a date for the next scheduled service
- This helps admin plan future assignments

**Navigation**:
- Click "Edit Report" to go back and make changes
- Click "Continue" when everything looks good

---

#### Step 4: Client Signature

**Getting the Signature**:
1. Hand the device to the client
2. Client signs on the digital signature pad
3. Client types their name in the field below

**Navigation**:
- Click "Clear" to erase and start over
- Click "Continue" when signature is complete

---

#### Step 5: Submit Report

**Final Check**:
- ✓ All sections completed
- ✓ Client signature obtained

**Choose Your Action**:

1. **Submit Report** (recommended):
   - Sends report to admin for review
   - You'll be unassigned from this client
   - Admin will reassign you for the next service
   - You'll get notified when admin reviews your report

2. **Save as Draft**:
   - Keep working on it later
   - Report stays in your drafts
   - You remain assigned to the client

3. **Download as JSON** (optional):
   - Creates an offline backup
   - Useful if you have connectivity concerns

---

### Report Submission Process

**If You're Online**:
- Report submits immediately
- You'll see a success confirmation
- Admin gets notified right away

**If You're Offline**:
- Report saves locally on your device
- Queues for automatic submission when you're back online
- You can export as JSON for extra backup
- System will retry submission on next sync

---

### Report History & Revision

**Viewing Your Reports**:
- Go to Reports section to see all your submitted reports
- Reports show their current status (Draft, Approved, Declined, Archived)

**If Admin Declines Your Report**:
- You'll see it in "Needs Revision" on your dashboard
- Open the report to read admin's notes
- Make the required changes
- Resubmit for review
- You'll be automatically reassigned to that client so you can access the report

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

## Equipment Tracking

### Overview
The system automatically tracks newly added bait stations and insect monitors to help with invoicing. When a PCO installs new equipment at a client site, the system flags it as "new" so it's easy to identify on reports and invoices.

### How It Works

#### Setting Up Client Equipment Baselines
When you create a new client, you set their expected equipment counts:
- **Inside Bait Stations**: How many bait stations are currently installed inside
- **Outside Bait Stations**: How many bait stations are currently installed outside
- **Light Monitors (Fly Traps)**: How many fly trap monitors are installed
- **Box Monitors**: How many box-type monitors are installed

These numbers tell the system what the client already has, so it can automatically detect when something new is added.

#### Adding New Equipment During a Service Visit

When a PCO creates a report and adds equipment:

**Scenario 1: Client has 5 inside bait stations**
1. PCO adds 7 inside bait stations to the report
2. When clicking "Continue", the system notices the difference
3. **A confirmation message appears**:
   ```
   You have added more stations than expected:
   • Inside: 7 (expected 5)
   
   Would you like to update the client's station count?
   ```
4. **If PCO clicks "Yes, Update"**:
   - The system automatically marks the 2 extra stations as "new"
   - The client's expected count is updated from 5 to 7
   - Next visit, the system will expect 7 stations
5. **If PCO clicks "No"**:
   - The report continues without updating
   - A warning will show about missing expected equipment

**The same process happens for**:
- Outside bait stations
- Light monitors (fly traps)
- Box monitors

#### Why This Matters for Invoicing

**Before (Manual Tracking)**:
- Admin had to manually count new equipment from reports
- Easy to miss new installations
- Time-consuming to prepare invoices

**Now (Automatic Tracking)**:
- New equipment is automatically flagged on the report
- Report summary shows total count of new equipment
- Easy to identify on PDF reports (new equipment highlighted)
- Accurate billing with no manual counting

#### Safety Net (Automatic Backup)
If the PCO skips the confirmation or something goes wrong, the system has a backup:
- When the report is submitted, the system double-checks the equipment counts
- If it finds equipment that wasn't marked as new, it marks it automatically
- This ensures no new equipment is ever missed

### Real-World Examples

#### Example 1: Regular Service Visit (No New Equipment)

**Situation**: ABC Restaurant has been a client for 6 months. They have 5 inside bait stations and 2 outside.

**What Happens**:
1. PCO arrives and services all 5 inside and 2 outside stations
2. PCO creates report and adds all 7 stations
3. When clicking "Continue" → **No message appears** (everything matches expected)
4. PCO completes report normally
5. **Report shows**: 0 new equipment added

**Result**: Quick and easy - no interruptions since nothing new was installed.

---

#### Example 2: Client Expansion (New Equipment Installed)

**Situation**: ABC Restaurant expands their kitchen. PCO installs 2 additional inside bait stations and 1 outside station.

**What Happens**:
1. PCO services and adds 7 inside stations and 3 outside stations to the report
2. When clicking "Continue" → **Confirmation message appears**:
   ```
   You have added more stations than expected:
   • Inside: 7 (expected 5)
   • Outside: 3 (expected 2)
   
   Would you like to update the client's station count?
   ```
3. PCO clicks **"Yes, Update"**
4. System automatically marks the 2 extra inside and 1 extra outside station as "new"
5. Client's expected count updates to match actual (7 inside, 3 outside)
6. **Report shows**: 3 new bait stations added
7. Admin sees report with new equipment highlighted for invoicing

**Result**: New equipment automatically tracked, ready for billing.

---

#### Example 3: Next Visit After Expansion

**Situation**: PCO returns to ABC Restaurant the following month. Client now has 7 inside and 3 outside stations (new baseline).

**What Happens**:
1. PCO services all 7 inside and 3 outside stations
2. PCO creates report and adds all 10 stations
3. When clicking "Continue" → **No message appears** (matches new expected count)
4. PCO completes report normally
5. **Report shows**: 0 new equipment added

**Result**: System remembers the updated count - smooth workflow continues.

### Benefits

**For Admin/Billing Team**:
- See new equipment at a glance on report summary
- New equipment highlighted on PDF reports
- No need to manually count or track additions
- Ready for accurate invoicing

**For PCO Users**:
- Simple workflow - just add equipment and continue
- System handles all tracking automatically
- Get confirmation when adding more than expected
- One click to update client equipment counts

**For Clients**:
- Clear documentation of what's new vs. regular service
- Transparent billing - new installations clearly marked
- Professional reports with equipment history

### Key Points to Remember

1. **Always set expected equipment counts** when creating a new client
2. **Click "Yes, Update"** when the system asks about new equipment - this keeps the client's baseline current
3. **New equipment is automatically highlighted** on reports for easy invoicing
4. **The system has a safety net** - even if something is missed, it will catch it during submission

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