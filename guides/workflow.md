# KPS Pest Control Management System
## Functional Specification & Workflow Documentation

> **Document Version**: 1.0.22  
> **Last Updated**: 09 February 2026  
> **Prepared For**: Client Signoff  
> **Status**: Final for Approval

---

## Executive Summary

This document provides a comprehensive overview of the KPS Pest Control Management System workflows and functionality. It describes how administrators and field officers (PCOs) interact with the system to manage clients, create service reports, and maintain pest control operations.

### Purpose
This specification serves as the formal documentation of all system features, workflows, and business processes. It is intended for stakeholder review and approval before final implementation.

### System Overview
The KPS Pest Control Management System is a web-based application consisting of two primary interfaces:
- **Admin Portal**: For office staff to manage clients, users, chemicals, assignments, and review service reports
- **PCO Portal**: For field officers to access their assignments, create service reports, and submit documentation

Both portals are mobile-responsive and designed for ease of use in the field and office environments

## Table of Contents
1. [System Components](#system-components)
2. [User Authentication & Security](#user-authentication--security)
3. [Admin Portal Features](#admin-portal-features)
4. [PCO Portal Features](#pco-portal-features)
5. [Report Management](#report-management)
6. [Equipment Tracking System](#equipment-tracking-system)
7. [Email & Notifications](#email--notifications)
8. [Business Rules](#business-rules)

---

## System Components

### Application Architecture
The system consists of two web portals accessed through standard web browsers:
- **Admin Portal**: Desktop and tablet optimized for office management tasks
- **PCO Portal**: Mobile-responsive design for field use on smartphones and tablets

### User Roles
**Administrator**
- Full system access and management capabilities
- Manage users, clients, chemicals, and assignments
- Review and approve service reports
- Send reports to clients
- View system-wide analytics and reports

**PCO (Pest Control Officer)**
- Access assigned client information
- Create and submit service reports
- View service history
- Receive notifications about assignments and report status

**Dual-Role Users**
- Some users may have both Admin and PCO capabilities
- Can switch between portals as needed
- Login prefix determines which portal to access (admin123 vs pco123)

---

## User Authentication & Security

### Login Process

#### How Users Access the System
Users log in using their assigned credentials:
- **Admin Access**: PCO number with "admin" prefix (e.g., admin12345)
- **PCO Access**: PCO number with "pco" prefix (e.g., pco67890)
- **Password**: Secure password set by administrator or changed by user

#### Login Flow
1. User enters their login ID and password
2. System validates credentials and account status
3. Upon successful login:
   - User is directed to their appropriate portal (Admin or PCO)
   - Session is created for secure access
   - Login activity is recorded for security purposes
4. Users with both Admin and PCO roles can access either portal by using the appropriate login prefix

#### Security Features
- **Account Protection**: Accounts are temporarily locked after multiple failed login attempts
- **Activity Logging**: All login attempts are recorded for security monitoring
- **Account Status**: Only active accounts can access the system
- **Session Management**: Secure session handling prevents unauthorized access

### Password Management

#### Password Security Requirements

The system enforces different password requirements depending on the operation:

**When Users Change Their Own Password** (via Profile page):
- Minimum 8 characters
- Must include uppercase letter, lowercase letter, and number
- Previous password required for verification
- All other active sessions are logged out for security

**When Admin Creates or Resets User Passwords**:
- Minimum 6 characters recommended
- Admin can set initial password
- User can change to stronger password via Profile page

**Password Reset (Forgot Password)**:
- Minimum 6 characters
- User requests reset link via email
- Reset link expires after 1 hour
- One-time use only for security

### User Profile Management

**PCO Users Can**:
- View their profile information (name, email, phone, PCO number)
- Change their password via Profile page
- View their service history

**Admin Users Can**:
- View and edit all user information
- Create new users with initial passwords
- Reset user passwords when needed
- Manage user roles (Admin, PCO, or Both)
- Deactivate user accounts
- View user activity logs
- Change their own password via Profile page

---

## Admin Portal Features

### Dashboard Overview

The admin dashboard provides at-a-glance insights into business operations:

**Key Metrics**:
- **Total Clients**: Count of all clients with growth trends
- **Active PCO Users**: Number of field officers available for assignments
- **Pending Reports**: Service reports awaiting admin review
- **Completed Reports**: Approved reports for the current month

**Dashboard Sections**:
- **Recent Activity**: Recent system events and updates
- **Upcoming Assignments**: Service dates requiring attention

**Quick Actions**:
- Create New Client
- Add PCO User
- Manage Assignments
- View All Reports

### User Management

#### Creating a New User
1. Navigate to Users section
2. Click "Add New User"
3. Enter user details:
   - PCO Number (auto-generated if not provided)
   - Full Name
   - Email Address (must be unique)
   - Phone Number (optional)
   - Initial Password (user can change later)
   - Role: Admin, PCO, or Both
4. Submit to create the user
5. User can log in immediately with provided credentials

**System Actions**:
- Validates uniqueness of PCO number and email
- Creates user account with "active" status
- Logs creation activity for audit purposes
- Sends welcome notification to new user

#### Editing User Information
- Administrators can update: Name, Email, Phone, Role
- Email addresses must remain unique
- PCO numbers cannot be changed
- Passwords are reset separately (see below)

#### Resetting User Passwords
- Select user and choose "Reset Password"
- Enter new temporary password (minimum 6 characters)
- All user's active sessions are logged out
- User should change password on next login

#### Deactivating Users
- User accounts are deactivated (not permanently deleted)
- Cannot deactivate users with active client assignments
- Cannot deactivate your own account
- User history and reports are preserved
- Deactivated users cannot log in

### Client Management

#### Adding a New Client
1. Navigate to Clients section
2. Click "Add New Client"
3. Enter client information:
   
   **Company Information**:
   - Company Name
   - Address (Line 1, Line 2, City, State, Postal Code)
   
   **Equipment Baseline** (for automatic new equipment detection):
   - Total Bait Stations Inside
   - Total Bait Stations Outside
   - Total Insect Monitors - Light (Fly Traps)
   - Total Insect Monitors - Box
   - *Note: These counts help the system automatically detect newly installed equipment*
   
   **Contact Persons** (add one or more):
   - Name
   - Role (Primary, Billing, Site Manager, Other)
   - Email Address
   - Phone Number

4. Save client record

**Important**: Equipment baseline counts are automatically updated after each service visit to  match actual equipment reported by PCOs.

#### Assigning PCOs to Clients

**Purpose**: Schedule PCOs for client service visits.

**How to Assign**:
1. Navigate to Schedule page
2. Select a PCO from the left sidebar (shows PCO name, number, and current assignment count)
3. Click "Assign Clients" button
4. In the assignment window:
   - Search for specific clients using the search box
   - View all clients with status indicators:
     - Green dot: Already assigned to another PCO
     - Gray dot: Unassigned and available
   - Select one or multiple unassigned clients
5. Click "Assign Selected"

**What Happens**:
- Selected clients appear in PCO's schedule immediately
- PCO can now view these clients in their portal
- PCO can create service reports for assigned clients
- System sends notification to PCO about new assignments

**Unassigning Clients**:
- Click "Unassign" button next to any assigned client
- Client becomes available for reassignment
- *Note: PCOs are automatically unassigned after submitting a report*

#### Managing Client Records
- Edit client information at any time
- Update equipment baselines manually if needed
- Add or remove contact persons
- Deactivate clients (preserves service history)

### Chemical Inventory Management

#### Adding Chemicals
1. Navigate to Chemicals section
2. Click "Add New Chemical"
3. Enter chemical information:
   - Chemical Name (must be unique)
   - Active Ingredients
   - Usage Type: Bait Inspection, Fumigation, or Both
   - Unit of Measurement (ml, g, kg, L, etc.)
   - L-Number (optional registration number)
   - Batch Number (optional, for tracking)
   - Safety Information (optional)
4. Submit to add chemical to inventory

**System Actions**:
- Chemical is set to "active" status
- Becomes immediately available in report creation
- L-Numbers and batch numbers are stored in uppercase

#### Managing Chemicals
- Edit chemical details at any time
- Toggle status between Active and Inactive
- Only active chemicals appear in dropdown menus
- Inactive chemicals remain in historical reports

#### Deleting Chemicals
- **If chemical has never been used**: Permanently removed from system
- **If chemical has been used in reports**: Deactivated but preserved for historical accuracy
- System automatically determines appropriate action

### Report Management

#### Report Status System

Service reports move through the following statuses:

- **Draft**: Report is being created by the PCO (work in progress)
- **Pending**: Report has been submitted and awaits admin review
- **Approved**: Admin has reviewed and approved the report
- **Declined**: Admin has rejected the report and returned it for revision
- **Emailed**: Approved report has been sent to the client
- **Archived**: Completed reports removed from active workflow

#### Viewing and Filtering Reports

1. Navigate to Reports section
2. Use status tabs to filter reports:
   - **Draft**: Reports currently being created
   - **Pending**: Submitted reports awaiting review (default view)
   - **Approved**: Approved reports ready to send to clients
   - **Declined**: Reports requiring PCO revision
   - **Emailed**: Reports already sent to clients
   - **Archived**: Completed historical reports

3. **Search and Filter Options**:
   - Search by client name, PCO name, or report ID
   - Filter by report type (Bait Inspection, Fumigation, or Both)
   - Filter by service date range
   - Results display 25 reports per page

#### Report Actions

Available actions depend on the report status:

- **View**: View complete report details
- **Edit**: Modify report information (admin only)
- **Approve**: Approve pending report (only for pending reports)
- **Decline**: Reject and return for revision (only for pending reports)
- **Email**: Send report PDF to client (only for approved reports)
- **Mark as Emailed**: Track emailed status without sending (only for approved reports)
- **Archive**: Move to archive (for approved and emailed reports)

#### Approving a Report

1. Admin clicks "Approve" button on a pending report
2. Review window displays:
   - Report ID and client name
   - Optional fields for admin notes and recommendations
3. Click confirm to approve
4. **System Actions**:
   - Report status changes from Pending to Approved
   - Admin notes and recommendations are saved (if provided)
   - PCO assignment is automatically removed (service complete)
   - PCO receives notification: "Report Approved"
   - Report becomes available to email to client

#### Declining a Report

1. Admin clicks "Decline" button on a pending report
2. Admin must provide feedback notes (minimum  10 characters):
   - Explain what needs correction
   - Provide clear guidance for PCO revision
3. Click confirm to decline
4. **System Actions**:
   - Report status changes to Declined
   - Admin feedback notes are saved
   - PCO is automatically reassigned to the client
   - PCO receives notification: "Report Declined - Revision Required" with admin feedback
   - PCO can now edit and resubmit the report

#### Archiving Reports

1. Click "Archive" button on approved or emailed report
2. Confirm archive action
3. **System Actions**:
   - Report status changes to Archived
   - Report moves to archive view
   - PCO receives "Report Archived" notification
   - Report remains accessible for viewing but separated from active workflow

#### Emailing Reports to Clients

**Purpose**: Send professional PDF report to client contacts with automatic tracking.

**How to Email a Report**:
1. Click "Email" button on an approved report
2. Email window displays:
   - Client contact list with names, roles, and email addresses
   - Recipients field (enter email addresses, comma-separated)
   - CC field (optional additional recipients)
   - Custom message field (optional additional message for email body)
3. Select or enter recipient email addresses
4. Add optional CC and custom message
5. Click "Send Email"

**System Actions**:
- Generates professional PDF report
- Sends email via company email system (mail.kpspestcontrol.co.za)
- Email includes:
  - KPS branding and logo
  - Report summary information
  - Custom message (if provided)
  - PDF attachment
  - Company contact information
- Marks report as "Emailed" with timestamp
- Report appears in "Emailed" tab
- Admin receives confirmation notification

**Email Features**:
- Professional HTML email template
- Report information summary table
- Custom message section
- KPS company footer
- Plain text version for compatibility

#### Mark as Emailed (Without Sending)

**Purpose**: Track emailed status for reports sent outside the system.

**Use Cases**:
- Report was emailed manually
- Report sent via different email system
- Maintaining accurate tracking without sending duplicates

**How to Mark as Emailed**:
1. Click "Mark as Emailed" on approved report
2. Confirm action
3. Report status updates to "Emailed" without actually sending email
4. Report appears in "Emailed" tab for tracking

---

## PCO Portal Features

### Dashboard

The PCO dashboard provides field officers with quick access to their assignments and tasks:

**Key Metrics**:
- **Assigned Clients**: Number of clients currently assigned for service
- **Draft Reports**: In-progress or submitted reports awaiting admin review
- **Needs Revision**: Reports declined by admin requiring attention

**Quick Actions**:
- Create New Report
- View Schedule
- View Service History
- Download for Offline (when online - caches client and chemical data)

**Report Import**:
- Upload previously exported reports (.kps files
- Continue editing incomplete reports
- Submit reports created offline

**How to Import**:
1. Click "Choose File" in Report Import section
2. Select .kps file
3. System validates and imports report data
4. Review and submit imported report

### Schedule Management

#### Viewing Assigned Clients

**How to Access**:
1. Click "Schedule" from main menu
2. View list of all clients assigned to you

**Information Displayed**:
- Client company name
- Service address
- Client status

**Important Notes**:
- Only clients assigned by admin appear in your schedule
- If client shows "inactive" status, contact admin before visiting
- After submitting a report, you are automatically unassigned (admin will reassign for next visit)

#### Starting a New Report

**Steps to Begin**:
1. From Schedule, select a client
2. Click "Create New Report"
3. System automatically:
   - Loads information from your last visit (if available)
   - Retrieves client's equipment baseline
   - Pre-fills data to save time

### Creating Service Reports

Service reports are created in 5 simple steps. The system saves your progress automatically.

**Equipment Tracking Note**:
The system automatically tracks newly installed equipment. When you add more equipment than the client's baseline, the system prompts you to confirm and automatically marks the additions for invoicing purposes.

#### Step 1: Report Setup

**Required Information**:
1. **Report Type**:
   - Bait Inspection only
   - Fumigation only
   - Both services

2. **Service Date**:
   - Defaults to today's date
   - Cannot select future dates

3. **Your Signature**:
   - Digital signature pad
   - Confirms you performed the service

**Navigation**:
- "Continue" to proceed to next step
- "Save Draft" to save and finish later

#### Step 2A: Bait Station Inspection (if applicable)

**Smart Pre-filling**:
- System loads data from your previous visit
- Stations with matching location and number are pre-filled
- Pre-filled data is highlighted for easy identification
- All pre-filled information can be edited

**Adding Bait Stations**:

Choose location: **Inside** or **Outside**

For each station, record:

1. **Station Number**: Your identification number

2. **Accessibility**:
   - Was station accessible?
   - If No: Explain why

3. **Activity**:
   - Signs of rodent activity?
   - If Yes: Select type (Droppings, Gnawing, Tracks, Other)

4. **Bait Status**:
   - Clean (no poison)
   - Eaten
   - Wet
   - Old

5. **Station Condition**:
   - Good
   - Needs Repair
   - Damaged
   - Missing
   - If not "Good": Action taken (Repaired or Replaced)

6. **Warning Sign**:
   - Good
   - Replaced
   - Repaired
   - Remounted

7. **Chemicals Used** (if any):
   - Add one or more chemicals
   - Enter chemical name, quantity, and batch number

8. **Remarks** (optional):
   - Additional notes about this station

**Managing Stations**:
- Save each station to add to your report
- Edit or delete stations as needed
- Missing station alert if count is below expected (can still proceed)

**When Complete**:
- Click "Continue"
- If you added more stations than expected, system asks if you want to update client's baseline

#### Step 2B: Fumigation Service (if applicable)

**Smart Pre-filling**:
- Chemicals and monitors from previous fumigation are pre-loaded
- Pre-filled data is highlighted
- Edit any information as needed

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
   - Add one or more chemicals
   - Select chemical, enter quantity and batch number

4. **Insect Monitors**:
   - Add monitors as needed
   - Type: Box or Light (Fly Trap)
   
   For each monitor:
   - **Condition**: Good, Replaced, Repaired, Other
   - **Warning Sign**: Good, Replaced, Repaired, Remounted
   - **Was Serviced**: Yes or No
   
   **For Light Monitors (Fly Traps) Only**:
   - **Light Condition**: Good or Faulty
   - If Faulty: Problem (Starter, Tube, Cable, Electricity, Other)
   - **Glue Board Replaced**: Yes or No
   - **Tubes Replaced**: Yes or No

5. **General Remarks** (optional):
   - Overall notes about fumigation service

**When Complete**:
- Click "Continue"
- If you added more monitors than expected, system asks for confirmation

#### Step 3: Review Summary & Next Service

**Review Information**:
- Service date
- Report type
- Your name
- Summary of bait stations (if applicable)
- Summary of fumigation (if applicable)

**Schedule Next Service**:
- Select date for next scheduled service
- Helps admin plan future assignments

**Navigation**:
- "Edit Report" to make changes
- "Continue" when information is correct

#### Step 4: Client Signature

**Information Captured**:
- **Client Name**: Full name in text field
- **Client Signature**: Digital signature on signature pad
- **Service Date**: Displayed from Step 1 (for reference)

**Getting Signature**:
1. Enter client's full name
2. Hand device to client
3. Client signs using finger or stylus
4. Review signature

**Note**: Service date from Step 1 serves as the official date. No separate signature date field is used.

**Navigation**:
- "Clear" to erase and start over
- "Back" to return to previous step
- "Next" when complete

#### Step 5: Submit Report

**Final Review**:
- All sections completed
- Client signature obtained

**Available Actions**:

1. **Submit Report** (recommended):
   - Sends to admin for review
   - You are unassigned from client
   - Admin will reassign for next service
   - Notification sent when admin reviews

2. **Save as Draft**:
   - Continue working later
   - Report stays in your drafts
   - You remain assigned to client

3. **Download as JSON** (optional):
   - Creates offline backup
   - Useful for connectivity concerns

### Report Submission

**Online Submission**:
- Report submits immediately
- Status changes to "Pending"
- You are automatically unassigned from client
- Equipment tracking executes automatically:
  - New equipment is detected and flagged
  - Client baseline counts are updated
- Admin receives notification

**Offline Submission**:
- Report saves locally on device
- Queues for automatic submission when online
- Can export as JSON for backup
- System retries submission when reconnected

### Report History & Revisions

**Viewing Your Reports**:
- Navigate to Reports section
- View all submitted reports with current status

**If Admin Declines Your Report**:
- Status changes to "Declined"
- You are automatically reassigned to that client
- Report appears in "Needs Revision" on dashboard
- Notification received with admin's feedback
- Open report to read admin feedback
- Make required changes
- Resubmit for review (status returns to "Pending")

---

## Report Management

### Report Workflow

```
PCO Creates Report (Draft)
         ↓
PCO Submits (Pending)
         ↓
Admin Reviews
    ↙    ↓    ↘
Approved Archived Declined
    ↓              ↓
Emailed to   PCO Revises
  Client          ↓
            Resubmits (Pending)
```

### Status Definitions

- **Draft**: Report in progress (PCO can edit)
- **Pending**: Submitted and awaiting admin review
- **Approved**: Admin approved, ready to send to client
- **Declined**: Returned to PCO with revision notes
- **Emailed**: Sent to client
- **Archived**: Completed and filed

---

## Equipment Tracking System

### Overview

The system automatically tracks newly installed pest control equipment to support accurate invoicing. When PCOs install new bait stations or insect monitors, the system flags them as "new additions" for easy identification.

### How It Works

#### Setting Client Equipment Baselines

When creating a new client, admin sets expected equipment counts:
- Inside Bait Stations
- Outside Bait Stations
- Light Monitors (Fly Traps)
- Box Monitors

These baselines help the system detect when new equipment is installed.

#### Adding New Equipment During Service

When adding equipment during a service visit:

**Example Scenario**: Client has 5 inside bait stations

1. PCO adds 7 inside bait stations to report
2. System detects difference when clicking "Continue"
3. **Confirmation message appears**:
   ```
   You have added more stations than expected:
   • Inside: 7 (expected 5)
   
   Would you like to update the client's station count?
   ```

4. **If PCO clicks "Yes, Update"**:
   - System marks 2 extra stations as "new"
   - Client's expected count updates to 7
   - Next visit will expect 7 stations

5. **If PCO clicks "No"**:
   - Report continues without update
   - Warning shows about missing expected equipment

**Same process applies to**:
- Outside bait stations
- Light monitors
- Box monitors

#### Benefits

**For Admin/Billing**:
- New equipment visible at a glance
- Highlighted on PDF reports
- No manual counting required
- Ready for accurate invoicing

**For PCO Users**:
- Simple workflow
- Automatic tracking
- Confirmation when adding equipment
- One click to update baselines

**For Clients**:
- Clear documentation of new installations
- Transparent billing
- Professional reports with equipment history

#### Automatic Safety Net

If confirmation is skipped, the system has a backup:
- On report submission, equipment counts are checked
- Any equipment not marked is automatically flagged
- Ensures no new equipment is missed

---

## Email & Notifications

### Email System

**Purpose**: Send professional service reports to clients with PDF attachments.

**Email Features**:
- Professional HTML templates with KPS branding
- PDF report generation and attachment
- Multiple recipients and CC support
- Custom message capability
- Company contact information in footer
- Plain text version for compatibility

**Email Server**: mail.kpspestcontrol.co.za

### Notification System

**In-App Notifications**:
- Real-time updates on assignments and report status
- System messages and alerts
- Displayed in both Admin and PCO portals

**PCO Notifications**:
- New client assignments
- Report approved notifications
- Report declined with feedback
- Report archived notices
- System updates

**Admin Notifications**:
- New report submissions
- Upcoming service dates
- System alerts and issues

---

## Business Rules

### Client Assignment Rules

- Each client can only be assigned to one PCO at a time
- PCO assignment automatically removed after report submission
- Admin must manually reassign for next service visit
- PCOs can only create reports for assigned clients

### User Account Rules

- PCO numbers must be unique
- Email addresses must be unique
- Only active users can log in
- Users cannot delete their own account
- Users with active assignments cannot be deleted

### Report Rules

- Service date cannot be in the future
- At least one service type required (Bait Inspection or Fumigation)
- Client signature required for submission
- Station numbers must be unique per location per report
- Only admins can add recommendations to reports
- PCOs can provide remarks and notes
- Reports cannot be edited by PCO after submission
- Only admins can edit submitted reports

### Data Integrity Rules

- User history preserved when accounts deactivated
- Client history preserved when clients deactivated
- Chemical usage linked to specific reports for historical accuracy
- Batch numbers tracked per report for compliance
- All critical operations logged for audit purposes

### Chemical Management Rules

- Chemical names must be unique
- Only active chemicals appear in selection menus
- Chemicals used in reports cannot be deleted (automatically deactivated instead)
- Unused chemicals can be permanently removed
- Chemical changes apply system-wide immediately

---

## System Security & Compliance

### Data Security

- All passwords encrypted before storage
- Secure session management
- Account lockout after failed login attempts
- Audit logging of all critical operations
- Data preservation for compliance

### Session Management

- Automatic session timeout for security
- Forced logout on password change (except current session)
- Secure token-based authentication
- Session activity logging

### Audit Trails

All critical operations are logged including:
- User login attempts (success and failure)
- User account changes
- Client assignments
- Report submissions and approvals
- Password changes and resets
- Administrative actions

---

## Ownership & Intellectual Property

### Source Code Ownership

**Dannel Web Design** retains 100% ownership of all source code, including but not limited to:
- Backend application code
- Frontend application code
- Database schemas and structures
- API implementations
- System architecture and design
- All proprietary algorithms and logic

### Client Usage Rights

**Client** receives full ownership and usage rights to:
- Frontend user interface and user experience
- All functionality as described in this specification
- Data generated and stored within the system
- Report outputs and generated documents
- Full rights to request modifications and enhancements

### Change Management

**Change Request Authorization**:
- All change requests must be submitted by the authorized signatory of this document
- Changes will be evaluated for scope, timeline, and impact
- A detailed change log will be maintained by Dannel Web Design
- Version control records will document all modifications
- Client will receive notification of all updates and changes

**Version Control**:
- Dannel Web Design maintains comprehensive version history
- All changes are documented with version numbers and descriptions
- Change logs are available for client review upon request
- Critical updates and security patches are applied proactively

### System Accessibility & Uptime

**Service Commitment**:
- Dannel Web Design commits to ensuring system accessibility and availability
- Routine maintenance will be scheduled during off-peak hours when possible
- Client will receive advance notice of planned maintenance windows

**Force Majeure**:
The system may become temporarily inaccessible due to circumstances beyond Dannel Web Design's control, including but not limited to:
- Internet service provider outages
- Hosting infrastructure failures
- Natural disasters or extreme weather events
- Power outages or utility failures
- Cyber attacks or security incidents
- Government actions or regulations

**Communication Protocol**:
- Client will be promptly notified of any unplanned downtime
- Regular status updates will be provided during extended outages
- Estimated time to resolution will be communicated when available
- Post-incident reports will be provided for significant disruptions

### Support & Maintenance

**Ongoing Support**:
- Technical support provided by Dannel Web Design
- Bug fixes and security updates included in maintenance
- Performance optimization and monitoring
- Regular system health checks

**Modification Rights**:
- Client may request feature enhancements at any time
- Scope and cost of modifications will be assessed individually
- Priority will be given to critical bug fixes and security updates
- Non-critical enhancements will be scheduled based on mutual agreement

### Data Ownership & Privacy

**Client Data**:
- All data entered into the system remains the property of the client
- Client has full rights to export data at any time
- Data backups are maintained for disaster recovery
- Data privacy and security are maintained per industry standards

---

## Client Signoff

### Document Purpose

This document serves as the complete functional specification for the KPS Pest Control Management System. It describes all features, workflows, and business processes implemented in the application.

### Approval

By signing below, the client acknowledges review and approval of the system functionality as described in this document.

**Client Name**: _______________________________

**Signature**: _______________________________

**Date**: _______________________________

**Company**: _______________________________

**Position**: _______________________________

---

### Revision History

| Version | Date | Description | Author |
|---------|------|-------------|--------|
| 1.0.22 | 09 Feb 2026 | Final specification for client signoff | System Team |
| 1.0.0 | Initial Release | Initial system documentation | System Team |

---

*This document represents the complete functionality of the KPS Pest Control Management System. All features described have been implemented and verified.*