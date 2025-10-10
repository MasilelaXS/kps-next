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
- **Admin Portal**: React.js with Vite (Web Application)
- **PCO Portal**: React Native (Mobile Application)
- **Backend**: RESTful API with pagination support
- **Data Sync**: Offline-first mobile app with sync capabilities
- **Authentication**: Role-based access control (Admin/PCO)

### Core Entities
- **Users** (Admin/PCO roles)
- **Clients** (Pest control service customers)
- **Chemicals** (Treatment products)
- **Reports** (Service documentation)
- **Bait Stations** (Inspection points)
- **Insect Monitors** (Monitoring devices)

---

## Authentication & User Management

### Login Process

#### For Admin Users (Web Portal)
1. User enters PCO number with "admin" prefix (e.g., "admin12345")
2. User enters password
3. System validates credentials and role
4. Redirect to Admin Dashboard

#### For PCO Users (Mobile App)
1. User enters PCO number with "pco" prefix (e.g., "pco12345")
2. User enters password
3. System validates credentials and role
4. **Data Synchronization Process Begins**:
   - Download assigned clients
   - Download all active chemicals
   - Download previous reports for context
   - Store data locally for offline use
5. Redirect to PCO Dashboard

#### Dual Role Users
- Users with both Admin and PCO roles must log out and log back in to switch roles
- Admin role: Use admin portal (web)
- PCO role: Use PCO mobile app

### User Profile Management
- **PCOs can**:
  - View and update their profile information
  - Change their password
  - View their service history
- **Admins can**:
  - Full CRUD operations on all users
  - Assign/manage user roles
  - View user activity logs

### Password Management
- **Forgot Password**: Email-based password reset
- **Password Requirements**: Simple (in-house system)
- **Password Update**: Available in user profile

---

## Admin Portal Workflows

### Dashboard
**Key Metrics Displayed:**
- Total active clients
- Reports pending approval
- Reports submitted today/this week
- Active PCOs
- Upcoming service dates requiring PCO assignment
- Recent activity feed

**Quick Actions:**
- Assign PCOs to upcoming services
- View pending reports
- Create new clients/users/chemicals

### User Management Workflow

#### Creating a User
1. Navigate to Users section
2. Click "Add New User"
3. Fill user details:
   - PCO Number (unique identifier)
   - Name, email, phone
   - Role selection (Admin/PCO/Both)
4. System generates temporary password
5. Send credentials to user via email
6. User must change password on first login

#### User Deletion Logic
- **Hard Delete**: If user has no associated reports
- **Soft Delete**: If user has reports (deactivate account, preserve data integrity)

### Client Management Workflow

#### Creating a Client
1. Navigate to Clients section
2. Click "Add New Client"
3. Fill client details:
   - Company name, address, contact information
   - Multiple contacts with roles (Primary, Billing, Site Manager, etc.)
   - Service preferences
4. Save client (initially unassigned)

#### Assigning PCO to Client
1. Select client from list
2. Click "Assign PCO"
3. Choose available PCO from dropdown
4. Confirm assignment
5. **System Actions**:
   - PCO receives push notification of new assignment
   - Client appears in PCO's schedule on next sync

#### Client Deletion Logic
- **Hard Delete**: If client has no associated reports
- **Soft Delete**: If client has reports (deactivate, preserve history)

### Chemical Management Workflow

#### Adding Chemicals
1. Navigate to Chemicals section
2. Click "Add New Chemical"
3. Fill chemical details:
   - Name, active ingredients
   - Usage type (Bait Inspection/Fumigation/Multi-purpose)
   - Quantity units (ml, grams, etc.)
   - Safety information
4. Set status (Active/Inactive)

#### Chemical Deletion Logic
- **Deactivate Only**: If chemical is linked to any reports
- **Permanent Delete**: If chemical has never been used in reports

### Report Management Workflow

#### Viewing All Reports
1. Navigate to Reports section
2. Use advanced search/filter options:
   - Client name, PCO name
   - Date range, report type
   - Status (Draft, Pending, Approved, Declined, Archived)
3. View paginated results (25 per page)

#### Report Status Management
```
Draft → Pending → Approved/Declined/Archived
         ↑              ↓
         └── Revision ←──┘
```

#### Report Approval Process
1. Select pending report
2. Review report details
3. Choose action:
   - **Approve**: Report becomes final, can be emailed to client
   - **Decline**: Add notes, send back to PCO for revision
   - **Archive**: Move to archived status

#### Report Actions
- **Edit**: Full editing capabilities (only when not approved)
- **Download PDF**: Generate formatted report
- **Email to Client**: Select contacts from client's contact list
- **Duplicate**: Create copy for similar service

#### Report Import
1. Navigate to "Import Report" section
2. Upload JSON file
3. System validates:
   - Client exists and is active
   - Chemicals exist and are active
   - PCO exists and is active
   - Data integrity checks
4. Preview import data
5. Confirm import or reject with validation errors

---

## PCO Mobile App Workflows

### Dashboard
**Display Elements:**
- Assigned clients count
- Pending reports count
- Reports needing revision
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
3. Begin report creation workflow

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
│ ○ Clean (default)               │
│ ○ Eaten ○ Wet                  │
│                                 │
│ Station Condition:              │
│ ○ Good ○ Needs Repair          │
│ ○ Damaged ○ Missing            │
│                                 │
│ Rodent Box Replaced: [Yes/No]   │
│                                 │
│ Chemicals Used: [+ Add]         │
│ [Chemical Name] [Qty] [Batch#]  │
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
│ Monitor Type: [Box/Fly Trap]    │
│ Glue Board Replaced: [Yes/No]   │
│ Tubes Replaced: [Yes/No]        │
│ (Only for Fly Trap)            │
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
                    │  (Editable) │          │
                    └─────────────┘          │
                           │                 │
                    PCO Submits              │
                           │                 │
                           ▼                 │ Admin Declines
                    ┌─────────────┐          │ (with notes)
                    │   Pending   │          │
                    │ (Read-only) │          │
                    └─────────────┘          │
                           │                 │
                    Admin Reviews            │
                           │                 │
                  ┌────────┼────────┐       │
                  ▼        ▼        ▼       │
            ┌──────────┐ ┌────────┐ ┌──────────┐
            │ Approved │ │ Archive│ │ Revision │──┘
            │(Final)   │ │        │ │ Required │
            └──────────┘ └────────┘ └──────────┘
```

### Status Descriptions
- **Draft**: PCO can edit, not visible to admin
- **Pending**: Submitted by PCO, awaiting admin review
- **Approved**: Final report, can be emailed to clients
- **Declined/Revision Required**: Returned to PCO with admin notes
- **Archived**: Completed but not for client distribution

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
   - Pending report submissions
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

### Data Integrity Rules
- All foreign key relationships maintained
- Audit trails for all critical operations
- Soft deletes preserve historical data
- Chemical usage tracking for compliance

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