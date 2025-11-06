# KPS Pest Control Management System - Complete Guide

**Last Updated**: November 5, 2025  
**Purpose**: Client Documentation & System Showcase

---

## Welcome to KPS

This guide provides a complete overview of the KPS Pest Control Management System - from how technicians submit service reports to how administrators manage operations and communicate with clients.

---

## Table of Contents

1. [Service Report Lifecycle](#service-report-lifecycle)
2. [User Authentication & Access](#user-authentication--access)
3. [Managing Service Reports](#managing-service-reports)
4. [Chemical Product Management](#chemical-product-management)
5. [Dashboard & Metrics](#dashboard--metrics)
6. [Password & Account Security](#password--account-security)
7. [Email Communication](#email-communication)
8. [Equipment Tracking](#equipment-tracking)
9. [User Management](#user-management)
10. [Client & Technician Assignment](#client--technician-assignment)

---

## Service Report Lifecycle

Understanding how reports move through the system:

### The Journey of a Service Report

**Step 1: Creation (Draft)**
- Technician creates a new report while on-site with the client
- Report is saved as "Draft" and can be edited freely
- Technician can save progress and return to finish later

**Step 2: Submission (Pending Review)**
- When ready, technician submits the completed report
- Report status automatically changes to "Pending"
- Report is now awaiting administrator review
- Technician is automatically unassigned from that client

**Step 3: Administrator Review**
The administrator has three options:

**Option A - Approve:**
- Administrator reviews and approves the report
- Report status changes to "Approved"
- Report is now ready to be emailed to the client

**Option B - Decline:**
- Administrator identifies issues requiring correction
- Administrator provides detailed feedback notes
- Report status changes to "Declined"
- Technician is automatically reassigned to that client
- Technician can view feedback, make corrections, and resubmit

**Option C - Archive:**
- Administrator archives completed reports
- Report status changes to "Archived"
- Report is removed from active workflow but remains accessible

**Step 4: Client Communication (Emailed)**
- Administrator emails the approved report to the client
- System generates a professional PDF report
- Email timestamp is recorded
- Report remains "Approved" status with email tracking

### Report Status Overview

The system organizes reports into 6 clear categories:

1. **Draft** - Reports being created by technicians
2. **Pending** - Reports submitted and awaiting administrator review
3. **Approved** - Reports approved and ready to email
4. **Declined** - Reports returned to technician for revision
5. **Emailed** - Reports sent to clients (shows which reports have been delivered)
6. **Archived** - Completed reports removed from active workflow

---

## User Authentication & Access

### Logging Into the System

**Two Types of Access:**

**Administrator Access**
- Login ID format: **admin** + your technician number
- Examples: `admin12345`, `ADMIN12345`, `Admin12345`, or even `admin 12345` (spaces allowed)
- Case-insensitive - type it however you like!
- Grants full system access: manage users, clients, reports, chemicals
- Review and approve service reports
- Communicate with clients via email

**Technician (PCO) Access**
- Login ID format: **pco** + your technician number  
- Examples: `pco12345`, `PCO12345`, `Pco12345`, or `pco 12345` (spaces allowed)
- Case-insensitive - type it however you like!
- Access to: create reports, view assigned clients, check service history
- Submit reports for administrator review

**Login Flexibility:**
The system automatically handles:
- **Any case combination**: ADMIN, Admin, admin, PCO, Pco, pco all work
- **Spaces are ignored**: "admin 12345" works the same as "admin12345"
- **Consistent experience**: No need to remember exact capitalization

### Dual Access Users

Some users can access both portals with the same credentials:
- Simply change the login prefix to switch between portals
- Log in with `admin12345` (or ADMIN12345 or Admin12345) to access administrator features
- Log in with `pco12345` (or PCO12345 or Pco12345) to access technician features
- No need to log out between switches

### Account Security Features

The system includes multiple security measures:
- Account temporarily locks after multiple failed login attempts
- All login attempts are logged for your security
- Only active accounts can access the system
- Complete audit trail of all authentication activity

---

## Managing Service Reports

### Administrator Report Dashboard

When you open the Reports section, you'll see 6 tabs at the top:

**1. Draft Tab**
- Shows reports currently being created
- Technicians can still edit these

**2. Pending Tab** (Default View)
- Shows all submitted reports awaiting your review
- This is where you'll spend most of your time
- Each report shows: Client name, Technician name, Service date, Report type

**3. Approved Tab**
- Shows reports you've approved that haven't been emailed yet
- Ready to send to clients

**4. Declined Tab**
- Shows reports you've sent back for revision
- Includes your feedback notes to the technician

**5. Emailed Tab**
- Shows all reports successfully sent to clients
- Includes date and time of email delivery

**6. Archived Tab**
- Completed reports removed from active workflow
- Searchable for historical reference

### Filtering & Searching Reports

Every tab includes powerful search tools:
- **Search by**: Client name or Technician name
- **Filter by Report Type**: All Types, Bait Inspection, Fumigation, or Both
- **Date Range**: Select "From" and "To" dates to narrow results
- **Results**: Display 25 reports per page with easy pagination

### Actions You Can Take on Reports

Depending on the report status, you'll see different action buttons:

**For Draft Reports:**
- **View** (👁️ icon) - See complete report details
- **Edit** - Make changes (draft reports are editable)
- Cannot download PDF - must be submitted first

**For Pending Reports:**
- **View** (👁️ icon) - See complete report details
- **Edit** - Make changes if needed before approval
- **Approve** (✓ icon) - Accept the report
- **Decline** (✗ icon) - Send back for revision with feedback
- Cannot download PDF - must be approved first

**For Approved Reports:**
- **View** - Review the report
- **Download PDF** - Generate formatted report for printing
- **Email** (✉️ icon) - Send to client
- **Archive** - Move to archive
- **Cannot Edit** - Approved reports are locked to maintain integrity

**For Declined Reports:**
- **View** - See report with admin feedback
- **Edit** - Technician can make corrections
- Cannot download PDF - must be approved first

**For Emailed Reports:**
- **View** - Review the report
- **Download PDF** - Generate formatted report for printing
- **Archive** - Move to archive
- **Cannot Edit** - Emailed reports are locked

**For Archived Reports:**
- **View** - Review historical report
- **Download PDF** - Generate formatted report for printing
- **Cannot Edit** - Archived reports are locked

### Important Report Restrictions

The system enforces the following rules to maintain data integrity:

**Editing Restrictions:**
- ✅ **Can Edit**: Draft, Pending, and Declined reports
- ❌ **Cannot Edit**: Approved, Emailed, and Archived reports
- **Why**: Once approved, reports become official records and must not be changed to maintain audit trail integrity

**PDF Download Restrictions:**
- ✅ **Can Download**: Approved, Emailed, and Archived reports
- ❌ **Cannot Download**: Draft, Pending, and Declined reports
- **Why**: Only finalized, approved reports should be distributed or printed

**Email Restrictions:**
- ✅ **Can Email**: Approved reports only
- ❌ **Cannot Email**: Draft, Pending, Declined, or Archived reports
- **Why**: Only approved reports are ready for client distribution

### Approving a Report

When you're ready to approve a report:

1. Click the **Approve** button (✓ icon) next to the report
2. A confirmation window appears showing:
   - Report ID number
   - Client name
   - Service date
3. **Optional**: Add your own notes or recommendations for the client
4. Click "Confirm Approval"

**What Happens:**
- Report status changes from "Pending" to "Approved"
- Your name and approval timestamp are recorded
- Technician receives a notification: "Report Approved"
- Report is now ready to email to the client
- The client-technician assignment ends (service complete)

### Declining a Report

If a report needs revision:

1. Click the **Decline** button (✗ icon) next to the report
2. A feedback form appears
3. **Required**: Enter detailed feedback for the technician (minimum 10 characters)
   - Be specific about what needs correction
   - Provide clear guidance for revision
4. Click "Confirm Decline"

**What Happens:**
- Report status changes from "Pending" to "Declined"
- Your feedback is saved and visible to the technician
- Your name and decline timestamp are recorded
- Technician is automatically reassigned to that client
- Technician receives notification: "Report Declined - Revision Required" with your feedback
- Technician can now edit and resubmit the report

### Archiving Reports

To move completed reports out of active workflow:

1. Click the **Archive** button on an approved or emailed report
2. Confirm the archive action
3. Report moves to the Archived tab

**What Happens:**
- Report status changes to "Archived"
- Your name and archive timestamp are recorded
- Technician receives notification: "Report Archived"
- Report remains searchable in the Archived tab

---

## Chemical Product Management

### Adding New Chemical Products

Navigate to the Chemicals section and click "Add New Chemical". You'll see a form with the following fields:

**Required Information:**

**1. Product Name** (2-200 characters)
- Enter the commercial name of the chemical product
- Must be unique - system will alert if name already exists
- Example: "RatX Ultra Bait Blocks"

**2. L-Number** (1-50 characters) - **Required for Product Identification**
- Registration or license number
- Used as unique identifier for tracking
- Automatically converted to uppercase for consistency
- Example: "L1234" becomes "L1234"
- **Important**: Required field - system uses this to identify products

**3. Batch Number** (1-100 characters) - **Required for Product Identification**
- Current batch or lot number
- Used as unique identifier for tracking
- Automatically converted to uppercase
- Example: "batch-2024-11" becomes "BATCH-2024-11"
- **Important**: Required field - system uses this to identify products

**4. Usage Type** (select one)
- **Bait Inspection**: For rodent bait stations
- **Fumigation**: For fumigation treatments
- **Multi-Purpose**: Can be used for both

**5. Quantity Unit** (1-20 characters)
- How you measure this product
- Examples: "ml", "grams", "kg", "liters", "sachets"

**Optional Information:**

**6. Active Ingredients** (minimum 2 characters if provided)
- List the active chemical components
- Example: "Bromadiolone 0.005%"
- Optional but recommended for safety tracking

**7. Safety Information**
- Any safety precautions or handling instructions
- Free text field for detailed notes

### What Happens When You Save

- Chemical is created with "Active" status
- L-Number and Batch Number are automatically capitalized
- System checks for duplicate names
- Chemical immediately appears in technician report forms
- All changes are logged for your records

### Editing Chemicals

You can update any chemical details at any time:
- Changes apply immediately across the system
- Historical reports keep the original chemical information
- Name uniqueness is verified (excluding current chemical)

### Chemical Status

Toggle chemicals between "Active" and "Inactive":
- **Active**: Appears in all technician report dropdowns
- **Inactive**: Hidden from new reports but preserved in history

### Deleting Chemicals

The system intelligently handles deletions:

**If the chemical has never been used:**
- Permanent deletion
- Complete removal from system

**If the chemical appears in any reports:**
- Automatic deactivation instead of deletion
- Status changed to "Inactive"
- Historical data preserved for report integrity

---

## Dashboard & Metrics

### Administrator Dashboard Overview

When you log into the administrator portal, your dashboard displays key business metrics:

**Total Clients**
- Count of all clients in your system
- Growth percentage compared to previous period
- Click to view full client list

**Active Technicians**
- Number of technicians currently active in the system
- Excludes inactive or suspended accounts
- Click to view technician roster

**Pending Reports**
- Count of reports submitted and awaiting your review
- These require your immediate attention
- Click to go directly to Pending Reports tab

**Completed Reports**
- Number of approved reports for the current month
- Shows your monthly productivity
- Click to view approved reports

### Quick Actions

Access common tasks directly from your dashboard:
- **New Client** - Add a new customer to the system
- **Add Technician** - Create a new technician account
- **Manage Assignments** - Assign technicians to clients
- **View Reports** - Jump to report management

### Recent Activity

See the last 24 hours of system activity:
- Report submissions
- Approvals and declines
- Client assignments
- User account changes

### Upcoming Assignments

View scheduled service dates that need attention:
- Services scheduled for today and upcoming days
- Clients requiring technician assignment
- Overdue service reminders

---

## Password & Account Security

### Changing Your Password

Both administrators and technicians can change their passwords from their Profile page.

**Step-by-Step Process:**

1. Navigate to your Profile page
2. Find the Security section
3. Click "Change Password" button
4. A form appears with three fields:

**Current Password**
- Enter your existing password to verify your identity
- Includes show/hide toggle for easy typing

**New Password**
- Enter your desired new password
- Includes show/hide toggle

**Confirm New Password**
- Re-enter the new password to confirm
- Includes show/hide toggle

5. Click "Update Password"

### Password Requirements

All passwords must include:
- **Minimum 8 characters**
- **At least one uppercase letter** (A-Z)
- **At least one lowercase letter** (a-z)
- **At least one number** (0-9)

The system checks your password as you type and shows immediate feedback if requirements aren't met.

### Security Features

When you successfully change your password:
- You remain logged in on your current device
- All other devices are automatically logged out
- This prevents unauthorized access if someone else knows your old password
- A confirmation message appears
- The form resets for security

### Forgot Password?

If you can't remember your password:

**Step 1: Request Reset**
1. Click "Forgot Password" on the login page
2. Enter your technician number (just the number, no prefix)
3. Click "Send Reset Link"

**Step 2: Check Your Email**
- You'll receive an email with a password reset link
- The link is valid for 1 hour
- Email includes security reminders
- Professional format with KPS branding

**Step 3: Create New Password**
1. Click the link in your email
2. Enter your new password (must meet requirements)
3. Confirm your new password
4. Click "Reset Password"

**What Happens:**
- Your password is immediately updated
- All active sessions are logged out (security measure)
- You're redirected to the login page
- You can log in with your new password

**Security Note:** The reset link can only be used once and expires after 1 hour.

---

## Email Communication

### Sending Reports to Clients

Once a report is approved, you can email it directly to the client from the system.

**How to Email a Report:**

1. Find the approved report in the Approved tab
2. Click the **Email** button (✉️ icon)
3. An email composition window opens

### Email Composition Window

**Client Contacts Section:**
- Displays all contacts associated with this client
- Shows: Contact Name, Role, Email Address
- Primary contact is highlighted
- Click any contact to automatically add their email to recipients

**Recipients Field**
- Enter email addresses that should receive the report
- Use commas to separate multiple addresses
- Example: john@company.com, jane@company.com
- Required field - at least one recipient needed

**CC Field** (Optional)
- Add email addresses for courtesy copies
- Same format as recipients (comma-separated)
- Example: manager@company.com

**Custom Message** (Optional)
- Add a personal message to the email
- Appears in the email body above the report details
- Use this to:
  - Highlight important findings
  - Mention follow-up actions
  - Add context for the client

**Send Email Button**
- Click to send the report

### What the Client Receives

Professional email with KPS branding containing:

**Email Header**
- KPS company logo and branding
- Professional layout

**Report Summary**
- Report ID number
- Service date
- Report type (Bait Inspection, Fumigation, or Both)
- Client company name
- Service address

**Your Custom Message** (if provided)
- Appears prominently in the email body

**PDF Attachment**
- Complete, professionally formatted report
- Includes all service details
- Ready to print or archive
- Contains:
  - Service technician information
  - Detailed inspection results
  - Chemical products used
  - Equipment status
  - Service photographs (if applicable)
  - Recommendations
  - Digital signatures

**Email Footer**
- KPS contact information
- Professional closing

### After Sending

**Immediate Confirmations:**
- Success notification appears
- Email timestamp is recorded
- Report moves to "Emailed" tab

**Email Tracking:**
- You can see exactly when each report was emailed
- Emailed tab shows delivery date and time
- Helps track client communication history

### Email Features

**Reliability:**
- Professional email delivery system
- Secure connection
- Delivery confirmation

**Organization:**
- All emailed reports in one place
- Easy to see communication history
- Search and filter emailed reports

---

## Equipment Tracking

### Understanding Equipment Baseline

For accurate invoicing and tracking, each client has a baseline equipment count:
- Number of bait stations installed inside
- Number of bait stations installed outside
- Number of light monitors (fly traps)
- Number of box monitors

These numbers tell the system what equipment the client already has, making it easy to identify when new equipment is installed.

### Setting Up Client Equipment

When you create a new client, you enter their current equipment:

**Inside Bait Stations:** [number]
**Outside Bait Stations:** [number]
**Light Monitors (Fly Traps):** [number]
**Box Monitors:** [number]

### How New Equipment is Tracked

When a technician adds more equipment than the baseline during a service visit, the system automatically detects this.

**Example Scenario:**

**Client Baseline:** 5 inside bait stations, 2 outside

**Technician Report:** 7 inside bait stations, 3 outside

**System Detection:**
- 2 additional inside stations installed
- 1 additional outside station installed

**Technician Confirmation:**
When the technician clicks "Continue" after adding equipment, a message appears:

```
You have added more stations than expected:
• Inside: 7 (expected 5)
• Outside: 3 (expected 2)

Would you like to update the client's equipment baseline?
```

**If technician clicks "Yes, Update":**
- The 2 extra inside stations are marked as "new"
- The 1 extra outside station is marked as "new"
- Client's baseline is updated from 5 to 7 (inside) and 2 to 3 (outside)
- Next service visit will expect these new counts

**If technician clicks "No":**
- Report continues without updating
- System remembers original baseline

### Automatic Safety Check

If the technician doesn't update the baseline, the system has a backup:
- When the report is submitted, the system double-checks equipment counts
- Any equipment exceeding the baseline is automatically marked as "new"
- Ensures no new installations are missed for billing

### Benefits for Your Business

**For Invoicing:**
- New equipment clearly identified on reports
- No manual counting needed
- Accurate billing every time
- Report summary shows total new equipment added

**For Operations:**
- Equipment history tracked automatically
- Easy to see installation trends
- Client equipment database stays current

**For Clients:**
- Clear documentation of new installations
- Transparent billing - new equipment highlighted
- Professional tracking of all equipment

### Report Display

Reports clearly show:
- Total equipment serviced
- Count of new equipment added this visit
- New equipment highlighted for easy identification
- Perfect for invoice preparation

---

## User Management

### Creating New Technician Accounts

Administrators can create new user accounts for technicians.

**Navigate to Users section and click "Add New User"**

**User Creation Form:**

**1. Technician Number** (Optional)
- Unique identifier for this technician
- If left blank, system automatically generates one
- Example: "12345"

**2. Full Name** (Required)
- Technician's full name
- Example: "John Smith"

**3. Email Address** (Required)
- Must be unique in the system
- Used for password resets and notifications
- System validates email format
- Example: "john.smith@company.com"

**4. Phone Number** (Optional)
- Contact number
- Example: "0123456789"

**5. Initial Password** (Required)
- Temporary password for first login
- Minimum 6 characters
- Technician can change after logging in
- You provide this password securely to the technician

**6. Access Level** (Required)
Select one:
- **Technician Only**: Can create reports, view assigned clients
- **Administrator Only**: Full system access, manage users and clients
- **Both**: Can access both technician and admin features

**Click "Create User"**

**What Happens:**
- Account created with "Active" status
- Technician can log in immediately
- Password is securely encrypted
- All activity is logged
- Technician number confirmed (auto-generated if you didn't provide one)

### Editing User Accounts

You can update user information at any time:

**Click "Edit" next to any user to modify:**
- Full Name
- Email Address (must remain unique)
- Phone Number
- Access Level

**You Cannot Edit:**
- Technician Number (permanent identifier)
- Password (use separate password reset feature)

All changes are logged with your admin ID and timestamp.

### Resetting User Passwords

As an administrator, you can reset any user's password:

**From the user list:**
1. Click "Reset Password" next to the user
2. Enter a new temporary password (minimum 6 characters)
3. Click "Confirm"

**What Happens:**
- Password is immediately updated
- User is logged out of all devices
- User can log in with new password
- Provide the new password securely to the user
- User should change password after logging in

### Deactivating User Accounts

**Why Deactivate:**
- Employee leaves the company
- Temporary suspension needed
- Account no longer in use

**How to Deactivate:**
1. Click "Delete" next to the user
2. Confirm the action

**Important Safeguards:**
- Cannot delete your own account
- Cannot delete users currently assigned to clients (must unassign first)
- All user data is preserved for historical records
- Reports created by this user remain intact
- Account is deactivated, not permanently deleted

**What Happens:**
- Account status changes to "Inactive"
- User cannot log in
- User disappears from active user lists
- Historical data remains searchable
- Can be reactivated if needed

---

## Client & Technician Assignment

### The Schedule System

The Schedule page is where you manage which technicians service which clients.

### Understanding the Schedule Interface

**Left Sidebar - Technician List:**
- Shows all active technicians
- Displays technician name and number
- Shows assignment count: "5 clients assigned"
- Click any technician to view their assignments

**Right Panel - Assigned Clients:**
- Shows all clients assigned to the selected technician
- Displays client name and service address
- Shows assignment date
- "No Assigned Clients" message if technician has no assignments

### Assigning Clients to Technicians

**Step-by-Step Assignment Process:**

**1. Select a Technician**
- Click on a technician in the left sidebar
- Their current assignments appear on the right

**2. Click "Assign Clients" Button**
- Assignment modal window opens

**3. Find Clients to Assign**

The assignment modal shows:

**Search Box** (at top)
- Type to quickly find specific clients
- Searches client company names

**Client List** (with status indicators)

🟢 **Green Indicator** = Already Assigned
- Shows which technician currently has this client
- Cannot select (one technician per client)

⚪ **Gray Indicator** = Available
- Not currently assigned to anyone
- Ready to assign
- Checkbox appears to select

**4. Select Clients**
- Click checkboxes next to unassigned clients
- Can select one or multiple clients
- Selected clients are highlighted

**5. Click "Assign Selected" Button**

**What Happens:**
- Clients immediately appear in the technician's schedule
- Assignment count updates
- Technician can now see these clients in their app
- Assignment recorded with your admin ID and timestamp
- Success notification confirms assignment

### Unassigning Clients

**Manual Unassignment:**
- Click "Unassign" button next to any assigned client
- Client is immediately removed from technician's schedule
- Client becomes available for reassignment

**Automatic Unassignment:**
When a technician submits a report:
- The system automatically unassigns that client
- Indicates service is complete
- Client ready for next service assignment

### Reassignment After Report Decline

Special workflow when you decline a report:
- The technician is automatically reassigned to that client
- Allows them to access and edit the declined report
- Makes the correction process seamless
- Assignment reactivated with new timestamp

### Assignment Rules

**Important Guidelines:**
- One client can only be assigned to one technician at a time
- Cannot assign inactive clients (system prevents this)
- Technician sees only their assigned clients in their app
- All assignment changes are logged with admin ID

### Viewing Assignment History

Each assignment record includes:
- Which admin made the assignment
- Date and time of assignment
- Date and time of unassignment (if applicable)
- Complete audit trail for accountability

---

## Summary

The KPS Pest Control Management System provides a complete solution for managing pest control operations from service delivery to client communication.

### Key Features Highlighted in This Guide

**For Administrators:**
- Complete report management with clear approval workflow
- Direct email communication with clients
- Chemical product database management
- User account creation and management
- Client-technician assignment control
- Real-time dashboard metrics
- Automatic equipment tracking for accurate billing

**For Technicians:**
- Easy-to-use report creation on mobile devices
- Automatic form pre-filling from previous visits
- Clear feedback when reports need revision
- View assigned clients and service history
- Secure account management

**For Your Business:**
- Streamlined workflow from service to client delivery
- Professional PDF reports with company branding
- Complete audit trail of all activities
- Accurate billing through automatic equipment tracking
- Organized client communication history

### System Benefits

**Efficiency:**
- Reduces manual paperwork
- Automates routine tasks
- Streamlines approval processes
- Faster client communication

**Accuracy:**
- Automatic equipment detection
- Data validation at every step
- No duplicate entries
- Clear audit trails

**Professionalism:**
- Branded email templates
- Professional PDF reports
- Timely client communication
- Organized records

**Security:**
- Secure password management
- Multi-level access control
- Complete activity logging
- Automatic session management

---

## Getting Started

To begin using the KPS system:

1. **Administrators** log in with: admin + your technician number (e.g., admin12345, ADMIN12345, or Admin 12345)
2. **Technicians** log in with: pco + your technician number (e.g., pco12345, PCO12345, or Pco 12345)
3. **Flexible Login**: Case doesn't matter, and spaces are automatically removed
4. Explore the dashboard to familiarize yourself with the interface
5. Follow the workflows outlined in this guide
6. Contact support if you need assistance

---

**Document Version**: 2.0  
**Last Updated**: November 5, 2025  
**Created For**: Client Demonstration & Training  

This guide covers all major features of the KPS Pest Control Management System. For specific questions or additional training, please contact your KPS representative.
