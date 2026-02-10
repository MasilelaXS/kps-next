# KPS Pest Control Management System
## Technical Implementation Documentation

---

**Document Version**: 1.0.22  
**Last Updated**: 10 February 2026  
**Audience**: Development Team  
**Classification**: Internal - Proprietary

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Authentication & Authorization](#authentication--authorization)
6. [Frontend Architecture](#frontend-architecture)
7. [Backend Architecture](#backend-architecture)
8. [Data Synchronization](#data-synchronization)
9. [Email System](#email-system)
10. [PDF Generation](#pdf-generation)
11. [Push Notifications](#push-notifications)
12. [Deployment](#deployment)
13. [Development Setup](#development-setup)
14. [Testing](#testing)
15. [Security Considerations](#security-considerations)
16. [Performance Optimization](#performance-optimization)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├──────────────────────┬──────────────────────────────────────┤
│  Admin Portal (Web)  │      PCO Portal (Mobile/Web)         │
│  - Next.js/React     │      - Next.js/React                 │
│  - Responsive UI     │      - PWA Enabled                   │
└──────────────┬───────┴──────────────┬───────────────────────┘
               │                       │
               └───────────┬───────────┘
                           │
                    ┌──────▼──────┐
                    │   Next.js   │
                    │  API Routes │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐     ┌──────▼──────┐   ┌────▼─────┐
    │ MySQL   │     │  Node.js    │   │  Redis   │
    │Database │     │  Services   │   │  Cache   │
    └─────────┘     └──────┬──────┘   └──────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐  ┌────▼────┐  ┌───▼────┐
         │ Email  │  │  PDF    │  │  Push  │
         │Service │  │Generation│  │  Notif │
         └────────┘  └─────────┘  └────────┘
```

### System Components

**Frontend:**
- Next.js 14+ (App Router)
- React 18+
- TypeScript
- Tailwind CSS
- Progressive Web App (PWA) capabilities

**Backend:**
- Next.js API Routes
- Node.js runtime
- TypeScript
- RESTful API architecture

**Database:**
- MySQL 8.0+
- Connection pooling via mysql2
- Prepared statements for security

**External Services:**
- Puppeteer (PDF generation)
- Nodemailer (email delivery)
- Web Push (notifications)

---

## Technology Stack

### Core Technologies

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 14+ |
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5+ |
| Database | MySQL | 8.0+ |
| Styling | Tailwind CSS | 3+ |
| PDF Generation | Puppeteer | Latest |
| Email | Nodemailer | Latest |

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "mysql2": "^3.0.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "nodemailer": "^6.9.0",
    "puppeteer": "^21.0.0",
    "web-push": "^3.6.0",
    "zod": "^3.22.0"
  }
}
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pco_number VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role ENUM('admin', 'pco', 'both') NOT NULL DEFAULT 'pco',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_pco_number (pco_number),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Clients Table

```sql
CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  
  -- Equipment baseline counts
  expected_bait_stations_inside INT DEFAULT 0,
  expected_bait_stations_outside INT DEFAULT 0,
  expected_monitors_light INT DEFAULT 0,
  expected_monitors_box INT DEFAULT 0,
  
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company_name (company_name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Client Contacts Table

```sql
CREATE TABLE client_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('primary', 'billing', 'site_manager', 'other') NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Assignments Table

```sql
CREATE TABLE assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  pco_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (pco_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_assignment (client_id, pco_id),
  INDEX idx_pco_id (pco_id),
  INDEX idx_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Chemicals Table

```sql
CREATE TABLE chemicals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  active_ingredients TEXT,
  usage_type ENUM('bait', 'fumigation', 'both') NOT NULL,
  unit_of_measurement VARCHAR(50),
  l_number VARCHAR(100),
  batch_number VARCHAR(100),
  safety_info TEXT,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Reports Table

```sql
CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  pco_id INT NOT NULL,
  report_type ENUM('bait', 'fumigation', 'both') NOT NULL,
  service_date DATE NOT NULL,
  next_service_date DATE,
  
  -- Signatures (base64 encoded data URLs)
  pco_signature TEXT,
  client_signature TEXT,
  client_name VARCHAR(255),
  
  -- Status workflow
  status ENUM('draft', 'pending', 'approved', 'declined', 'emailed', 'archived') 
    NOT NULL DEFAULT 'draft',
  
  -- Admin feedback
  admin_notes TEXT,
  admin_recommendations TEXT,
  decline_reason TEXT,
  
  -- Email tracking
  emailed_at TIMESTAMP NULL,
  emailed_to TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (pco_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_pco_id (pco_id),
  INDEX idx_client_id (client_id),
  INDEX idx_service_date (service_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Bait Stations Table

```sql
CREATE TABLE bait_stations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  location ENUM('inside', 'outside') NOT NULL,
  station_number VARCHAR(50) NOT NULL,
  accessible BOOLEAN DEFAULT TRUE,
  accessibility_reason TEXT,
  
  activity_present BOOLEAN DEFAULT FALSE,
  activity_type VARCHAR(255),
  
  bait_status ENUM('clean', 'eaten', 'wet', 'old'),
  
  station_condition ENUM('good', 'needs_repair', 'damaged', 'missing') DEFAULT 'good',
  action_taken ENUM('none', 'repaired', 'replaced'),
  
  warning_sign_status ENUM('good', 'replaced', 'repaired', 'remounted') DEFAULT 'good',
  
  remarks TEXT,
  is_new BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  INDEX idx_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Bait Station Chemicals Table

```sql
CREATE TABLE bait_station_chemicals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bait_station_id INT NOT NULL,
  chemical_id INT NOT NULL,
  quantity DECIMAL(10,2),
  batch_number VARCHAR(100),
  FOREIGN KEY (bait_station_id) REFERENCES bait_stations(id) ON DELETE CASCADE,
  FOREIGN KEY (chemical_id) REFERENCES chemicals(id) ON DELETE CASCADE,
  INDEX idx_bait_station_id (bait_station_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Fumigation Details Table

```sql
CREATE TABLE fumigation_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  areas_treated JSON,
  target_pests JSON,
  general_remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  UNIQUE KEY unique_report (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Fumigation Chemicals Table

```sql
CREATE TABLE fumigation_chemicals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fumigation_id INT NOT NULL,
  chemical_id INT NOT NULL,
  quantity DECIMAL(10,2),
  batch_number VARCHAR(100),
  FOREIGN KEY (fumigation_id) REFERENCES fumigation_details(id) ON DELETE CASCADE,
  FOREIGN KEY (chemical_id) REFERENCES chemicals(id) ON DELETE CASCADE,
  INDEX idx_fumigation_id (fumigation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Insect Monitors Table

```sql
CREATE TABLE insect_monitors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fumigation_id INT NOT NULL,
  monitor_type ENUM('box', 'light') NOT NULL,
  
  monitor_condition ENUM('good', 'replaced', 'repaired', 'other') DEFAULT 'good',
  warning_sign_status ENUM('good', 'replaced', 'repaired', 'remounted') DEFAULT 'good',
  was_serviced BOOLEAN DEFAULT FALSE,
  
  -- Light monitor specific fields
  light_condition ENUM('good', 'faulty'),
  light_problem VARCHAR(255),
  glue_board_replaced BOOLEAN,
  tubes_replaced BOOLEAN,
  
  is_new BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fumigation_id) REFERENCES fumigation_details(id) ON DELETE CASCADE,
  INDEX idx_fumigation_id (fumigation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Notifications Table

```sql
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Push Subscriptions Table

```sql
CREATE TABLE push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Activity Logs Table

```sql
CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## API Reference

### Authentication Endpoints

#### POST `/api/auth/login`
Authenticate user and return JWT token.

**Request Body:**
```json
{
  "loginId": "admin12345",
  "password": "userPassword"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "pcoNumber": "12345",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "admin"
  },
  "redirect": "/admin/dashboard"
}
```

**Error Codes:**
- `400`: Missing required fields
- `401`: Invalid credentials
- `403`: Account locked or inactive
- `500`: Server error

---

#### POST `/api/auth/logout`
Invalidate current session.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### POST `/api/auth/forgot-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset link sent to email"
}
```

---

#### POST `/api/auth/reset-password`
Reset password using token.

**Request Body:**
```json
{
  "token": "reset_token",
  "newPassword": "newSecurePassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

### User Management Endpoints

#### GET `/api/admin/users`
Retrieve all users (admin only).

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Query Parameters:**
- `role` (optional): Filter by role (admin, pco, both)
- `status` (optional): Filter by status (active, inactive)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25)

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "pcoNumber": "12345",
      "email": "user@example.com",
      "fullName": "John Doe",
      "phone": "0123456789",
      "role": "admin",
      "status": "active",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 50,
    "totalPages": 2
  }
}
```

---

#### POST `/api/admin/users`
Create new user (admin only).

**Request Body:**
```json
{
  "pcoNumber": "12345",
  "email": "newuser@example.com",
  "fullName": "Jane Smith",
  "phone": "0987654321",
  "password": "initialPassword",
  "role": "pco"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "userId": 2
}
```

**Validation:**
- `pcoNumber`: Required if not auto-generated, unique
- `email`: Required, valid email format, unique
- `fullName`: Required, 2-255 characters
- `password`: Minimum 6 characters
- `role`: Must be 'admin', 'pco', or 'both'

---

#### PUT `/api/admin/users/:id`
Update user information (admin only).

**Request Body:**
```json
{
  "fullName": "Updated Name",
  "email": "updated@example.com",
  "phone": "1234567890",
  "role": "both"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully"
}
```

---

#### POST `/api/admin/users/:id/reset-password`
Reset user password (admin only).

**Request Body:**
```json
{
  "newPassword": "temporaryPassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

#### PUT `/api/admin/users/:id/deactivate`
Deactivate user account (admin only).

**Response:**
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

**Validation:**
- Cannot deactivate own account
- Cannot deactivate user with active assignments

---

### Client Management Endpoints

#### GET `/api/admin/clients`
Retrieve all clients.

**Query Parameters:**
- `status` (optional): active | inactive
- `search` (optional): Search by company name
- `page`, `limit`: Pagination

**Response:**
```json
{
  "success": true,
  "clients": [
    {
      "id": 1,
      "companyName": "ABC Company",
      "address": {
        "line1": "123 Main St",
        "line2": "Suite 100",
        "city": "Johannesburg",
        "state": "Gauteng",
        "postalCode": "2000"
      },
      "equipmentBaseline": {
        "baitStationsInside": 10,
        "baitStationsOutside": 15,
        "monitorsLight": 5,
        "monitorsBox": 3
      },
      "contacts": [
        {
          "id": 1,
          "name": "John Contact",
          "role": "primary",
          "email": "contact@abc.com",
          "phone": "0123456789"
        }
      ],
      "status": "active",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### POST `/api/admin/clients`
Create new client.

**Request Body:**
```json
{
  "companyName": "New Company",
  "address": {
    "line1": "456 Oak Ave",
    "line2": "",
    "city": "Cape Town",
    "state": "Western Cape",
    "postalCode": "8000"
  },
  "equipmentBaseline": {
    "baitStationsInside": 8,
    "baitStationsOutside": 12,
    "monitorsLight": 4,
    "monitorsBox": 2
  },
  "contacts": [
    {
      "name": "Contact Person",
      "role": "primary",
      "email": "contact@newcompany.com",
      "phone": "0987654321"
    }
  ]
}
```

---

#### PUT `/api/admin/clients/:id`
Update client information.

---

### Assignment Endpoints

#### GET `/api/admin/assignments`
Get all current assignments.

**Response:**
```json
{
  "success": true,
  "assignments": [
    {
      "id": 1,
      "client": {
        "id": 1,
        "companyName": "ABC Company"
      },
      "pco": {
        "id": 2,
        "fullName": "John PCO",
        "pcoNumber": "67890"
      },
      "assignedAt": "2026-02-01T10:00:00.000Z"
    }
  ]
}
```

---

#### POST `/api/admin/assignments`
Assign PCO to client(s).

**Request Body:**
```json
{
  "pcoId": 2,
  "clientIds": [1, 3, 5]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assigned 3 clients to PCO",
  "assignments": [1, 2, 3]
}
```

---

#### DELETE `/api/admin/assignments/:id`
Unassign PCO from client.

---

### Report Endpoints

#### GET `/api/reports`
Get reports (filtered by role).

**Query Parameters:**
- `status`: draft | pending | approved | declined | emailed | archived
- `type`: bait | fumigation | both
- `clientId`: Filter by client
- `pcoId`: Filter by PCO
- `startDate`, `endDate`: Date range filter
- `page`, `limit`: Pagination

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "id": 1,
      "client": {
        "id": 1,
        "companyName": "ABC Company"
      },
      "pco": {
        "id": 2,
        "fullName": "John PCO"
      },
      "reportType": "both",
      "serviceDate": "2026-02-09",
      "nextServiceDate": "2026-03-09",
      "status": "pending",
      "createdAt": "2026-02-09T14:30:00.000Z",
      "submittedAt": "2026-02-09T16:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "totalPages": 4
  }
}
```

---

#### GET `/api/reports/:id`
Get detailed report information.

**Response:**
```json
{
  "success": true,
  "report": {
    "id": 1,
    "client": { /* full client details */ },
    "pco": { /* full PCO details */ },
    "reportType": "both",
    "serviceDate": "2026-02-09",
    "nextServiceDate": "2026-03-09",
    "status": "pending",
    "pcoSignature": "data:image/png;base64,...",
    "clientSignature": "data:image/png;base64,...",
    "clientName": "Client Representative",
    "baitStations": [
      {
        "id": 1,
        "location": "inside",
        "stationNumber": "BS-001",
        "accessible": true,
        "activityPresent": false,
        "baitStatus": "clean",
        "stationCondition": "good",
        "warningSignStatus": "good",
        "chemicals": [
          {
            "chemicalId": 5,
            "chemicalName": "Rodenticide A",
            "quantity": 50,
            "batchNumber": "BATCH123"
          }
        ],
        "remarks": "Station in good condition",
        "isNew": false
      }
    ],
    "fumigation": {
      "id": 1,
      "areasTreated": ["kitchen", "storage_room"],
      "targetPests": ["cockroaches", "ants"],
      "chemicals": [
        {
          "chemicalId": 3,
          "chemicalName": "Insecticide X",
          "quantity": 200,
          "batchNumber": "BATCH456"
        }
      ],
      "monitors": [
        {
          "id": 1,
          "monitorType": "light",
          "monitorCondition": "good",
          "warningSignStatus": "good",
          "wasServiced": true,
          "lightCondition": "good",
          "glueBoardReplaced": true,
          "tubesReplaced": false,
          "isNew": false
        }
      ],
      "generalRemarks": "All areas treated successfully"
    },
    "adminNotes": "",
    "adminRecommendations": "",
    "emailedAt": null,
    "emailedTo": null
  }
}
```

---

#### POST `/api/pco/reports`
Create new report (PCO only).

**Request Body:**
```json
{
  "clientId": 1,
  "reportType": "both",
  "serviceDate": "2026-02-09",
  "nextServiceDate": "2026-03-09",
  "pcoSignature": "data:image/png;base64,...",
  "clientSignature": "data:image/png;base64,...",
  "clientName": "Client Rep Name",
  "baitStations": [ /* array of bait station objects */ ],
  "fumigation": { /* fumigation details object */ }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Report created successfully",
  "reportId": 1
}
```

---

#### PUT `/api/pco/reports/:id`
Update draft or declined report (PCO only).

---

#### POST `/api/pco/reports/:id/submit`
Submit report for admin review.

**Response:**
```json
{
  "success": true,
  "message": "Report submitted for review"
}
```

**System Actions:**
- Status changes to 'pending'
- PCO unassigned from client
- Equipment tracking executed (new equipment flagged)
- Client baseline counts updated
- Admin notification sent

---

#### POST `/api/admin/reports/:id/approve`
Approve pending report (admin only).

**Request Body:**
```json
{
  "adminNotes": "Optional admin notes",
  "adminRecommendations": "Optional recommendations"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Report approved successfully"
}
```

---

#### POST `/api/admin/reports/:id/decline`
Decline report and return for revision (admin only).

**Request Body:**
```json
{
  "declineReason": "Please add more details about station BS-005"
}
```

**Validation:**
- `declineReason`: Required, minimum 10 characters

**System Actions:**
- Status changes to 'declined'
- PCO reassigned to client
- PCO notification sent with decline reason

---

#### POST `/api/admin/reports/:id/email`
Send report PDF to client via email (admin only).

**Request Body:**
```json
{
  "recipients": ["contact1@client.com", "contact2@client.com"],
  "cc": ["billing@client.com"],
  "customMessage": "Optional custom message for email body"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Report emailed successfully",
  "emailedTo": "contact1@client.com, contact2@client.com"
}
```

**System Actions:**
- Generate PDF report
- Send email via Nodemailer
- Update status to 'emailed'
- Record timestamp and recipients

---

#### POST `/api/admin/reports/:id/mark-emailed`
Mark report as emailed without sending (admin only).

---

#### POST `/api/admin/reports/:id/archive`
Archive report (admin only).

---

### Chemical Management Endpoints

#### GET `/api/chemicals`
Get all chemicals.

**Query Parameters:**
- `status`: active | inactive
- `usageType`: bait | fumigation | both

**Response:**
```json
{
  "success": true,
  "chemicals": [
    {
      "id": 1,
      "name": "Rodenticide A",
      "activeIngredients": "Bromadiolone 0.005%",
      "usageType": "bait",
      "unitOfMeasurement": "g",
      "lNumber": "L12345",
      "batchNumber": "BATCH001",
      "safetyInfo": "Keep away from children",
      "status": "active",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### POST `/api/admin/chemicals`
Create new chemical (admin only).

**Request Body:**
```json
{
  "name": "New Chemical",
  "activeIngredients": "Active ingredients list",
  "usageType": "both",
  "unitOfMeasurement": "ml",
  "lNumber": "L67890",
  "batchNumber": "BATCH002",
  "safetyInfo": "Safety instructions"
}
```

---

#### PUT `/api/admin/chemicals/:id`
Update chemical (admin only).

---

#### DELETE `/api/admin/chemicals/:id`
Delete or deactivate chemical (admin only).

**System Logic:**
- If never used in reports: Permanently deleted
- If used in reports: Status set to 'inactive'

---

### Notification Endpoints

#### GET `/api/notifications`
Get user notifications.

**Query Parameters:**
- `unreadOnly`: true | false

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "type": "report_approved",
      "title": "Report Approved",
      "message": "Your report for ABC Company has been approved",
      "relatedId": 5,
      "isRead": false,
      "createdAt": "2026-02-09T16:30:00.000Z"
    }
  ]
}
```

---

#### PUT `/api/notifications/:id/read`
Mark notification as read.

---

#### POST `/api/push/subscribe`
Subscribe to push notifications.

**Request Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "key_here",
      "auth": "auth_here"
    }
  }
}
```

---

## Authentication & Authorization

### JWT Token Structure

**Payload:**
```json
{
  "userId": 1,
  "pcoNumber": "12345",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1707494400,
  "exp": 1707580800
}
```

**Token Expiration:**
- Default: 24 hours
- Refresh: Not implemented (user must re-login)

### Password Security

**Hashing:**
- Algorithm: bcrypt
- Salt rounds: 10
- Storage: password_hash column

**Password Requirements:**

1. **User Self-Change** (Profile page):
   - Minimum 8 characters
   - Must contain: uppercase, lowercase, number
   - Previous password required

2. **Admin Set/Reset**:
   - Minimum 6 characters
   - No complexity requirement

3. **Forgot Password Reset**:
   - Minimum 6 characters
   - Token expires: 1 hour
   - One-time use only

**Password Operations:**
```typescript
import bcrypt from 'bcrypt';

// Hash password
const hash = await bcrypt.hash(password, 10);

// Verify password
const isValid = await bcrypt.compare(password, hash);
```

### Middleware Authentication

```typescript
// middleware/auth.ts
import jwt from 'jsonwebtoken';

export async function authenticate(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Unauthorized');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function requireRole(role: 'admin' | 'pco' | 'both') {
  return async (req: Request) => {
    const user = await authenticate(req);
    
    if (user.role !== role && user.role !== 'both') {
      throw new Error('Forbidden');
    }
    
    return user;
  };
}
```

### Login Flow Implementation

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { loginId, password } = await req.json();
  
  // Validate input
  if (!loginId || !password) {
    return NextResponse.json(
      { success: false, error: 'Missing credentials' },
      { status: 400 }
    );
  }
  
  // Determine role from prefix
  let role: 'admin' | 'pco';
  let pcoNumber: string;
  
  if (loginId.startsWith('admin')) {
    role = 'admin';
    pcoNumber = loginId.replace('admin', '');
  } else if (loginId.startsWith('pco')) {
    role = 'pco';
    pcoNumber = loginId.replace('pco', '');
  } else {
    return NextResponse.json(
      { success: false, error: 'Invalid login format' },
      { status: 400 }
    );
  }
  
  // Find user
  const users = await query(
    'SELECT * FROM users WHERE pco_number = ?',
    [pcoNumber]
  );
  
  if (users.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }
  
  const user = users[0];
  
  // Check account status
  if (user.status !== 'active') {
    return NextResponse.json(
      { success: false, error: 'Account is inactive' },
      { status: 403 }
    );
  }
  
  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    // Log failed attempt
    await logFailedLogin(user.id);
    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }
  
  // Check role permission
  if (user.role === 'admin' && role === 'pco') {
    return NextResponse.json(
      { success: false, error: 'No PCO access' },
      { status: 403 }
    );
  }
  
  if (user.role === 'pco' && role === 'admin') {
    return NextResponse.json(
      { success: false, error: 'No admin access' },
      { status: 403 }
    );
  }
  
  // Generate JWT
  const token = jwt.sign(
    {
      userId: user.id,
      pcoNumber: user.pco_number,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
  
  // Log successful login
  await logSuccessfulLogin(user.id);
  
  // Determine redirect
  const redirect = role === 'admin' ? '/admin/dashboard' : '/pco/dashboard';
  
  return NextResponse.json({
    success: true,
    token,
    user: {
      id: user.id,
      pcoNumber: user.pco_number,
      email: user.email,
      fullName: user.full_name,
      role: user.role
    },
    redirect
  });
}
```

---

## Frontend Architecture

### Directory Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── clients/
│   │   ├── schedule/
│   │   ├── reports/
│   │   └── chemicals/
│   ├── pco/
│   │   ├── dashboard/
│   │   ├── schedule/
│   │   ├── reports/
│   │   │   ├── create/
│   │   │   └── [id]/edit/
│   │   └── profile/
│   └── api/
│       ├── auth/
│       ├── admin/
│       ├── pco/
│       └── reports/
├── components/
│   ├── ui/ (reusable UI components)
│   ├── admin/
│   ├── pco/
│   └── shared/
├── lib/
│   ├── db.ts (database connection)
│   ├── auth.ts (auth utilities)
│   ├── validation.ts (Zod schemas)
│   └── utils.ts
├── types/
│   ├── database.ts
│   ├── api.ts
│   └── index.ts
└── middleware.ts
```

### State Management

**Client-Side State:**
- React Context for user authentication
- Local state with useState/useReducer
- Form state with controlled components

**Server State:**
- React Query / SWR for data fetching
- Cache management
- Optimistic updates

**Example: Auth Context**
```typescript
// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  pcoNumber: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    // Check for existing token
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and load user
      verifyToken(token).then(setUser).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);
  
  const login = async (loginId: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error);
    }
    
    localStorage.setItem('token', data.token);
    setUser(data.user);
    router.push(data.redirect);
  };
  
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Form Validation

Using Zod for schema validation:

```typescript
// lib/validation.ts
import { z } from 'zod';

export const loginSchema = z.object({
  loginId: z.string().min(1, 'Login ID is required'),
  password: z.string().min(1, 'Password is required')
});

export const createUserSchema = z.object({
  pcoNumber: z.string().optional(),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'pco', 'both'])
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

export const reportSchema = z.object({
  clientId: z.number().positive(),
  reportType: z.enum(['bait', 'fumigation', 'both']),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pcoSignature: z.string().startsWith('data:image'),
  clientSignature: z.string().startsWith('data:image'),
  clientName: z.string().min(2),
  baitStations: z.array(z.object({
    location: z.enum(['inside', 'outside']),
    stationNumber: z.string(),
    accessible: z.boolean(),
    // ... more fields
  })).optional(),
  fumigation: z.object({
    // ... fumigation fields
  }).optional()
});
```

---

## Backend Architecture

### Database Connection

```typescript
// lib/db.ts
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export async function query(sql: string, params?: any[]) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function transaction(callback: (connection: any) => Promise<void>) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    await callback(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default pool;
```

### API Route Structure

```typescript
// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/middleware/auth';
import { query } from '@/lib/db';
import { createUserSchema } from '@/lib/validation';

// GET /api/admin/users
export async function GET(req: NextRequest) {
  try {
    // Authenticate and check role
    const user = await requireRole('admin')(req);
    
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;
    
    // Build query
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];
    
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    // Get total count
    const [countResult] = await query(
      sql.replace('*', 'COUNT(*) as total'),
      params
    );
    const total = countResult.total;
    
    // Get paginated results
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const users = await query(sql, params);
    
    return NextResponse.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

// POST /api/admin/users
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('admin')(req);
    const body = await req.json();
    
    // Validate input
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.errors },
        { status: 400 }
      );
    }
    
    const data = validation.data;
    
    // Check for duplicate email
    const existing = await query(
      'SELECT id FROM users WHERE email = ?',
      [data.email]
    );
    
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }
    
    // Generate PCO number if not provided
    const pcoNumber = data.pcoNumber || await generatePcoNumber();
    
    // Hash password
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    // Insert user
    const result = await query(
      `INSERT INTO users (pco_number, email, password_hash, full_name, phone, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [pcoNumber, data.email, passwordHash, data.fullName, data.phone || null, data.role]
    );
    
    // Log activity
    await logActivity(user.userId, 'create_user', 'user', result.insertId);
    
    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId: result.insertId
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Email System

### Configuration

```typescript
// lib/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'mail.kpspestcontrol.co.za',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendEmail({
  to,
  cc,
  subject,
  html,
  attachments
}: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  attachments?: any[];
}) {
  const mailOptions = {
    from: `"KPS Pest Control" <${process.env.SMTP_FROM || 'noreply@kpspestcontrol.co.za'}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
    subject,
    html,
    attachments
  };
  
  return await transporter.sendMail(mailOptions);
}
```

### Report Email Template

```typescript
// lib/email-templates.ts
export function reportEmailTemplate({
  clientName,
  reportId,
  serviceDate,
  pcoName,
  reportType,
  customMessage
}: {
  clientName: string;
  reportId: number;
  serviceDate: string;
  pcoName: string;
  reportType: string;
  customMessage?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .info-table td { padding: 10px; border-bottom: 1px solid #ddd; }
        .info-table td:first-child { font-weight: bold; width: 30%; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .custom-message { background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-left: 4px solid #2196f3; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KPS Pest Control</h1>
        <p>Service Report</p>
      </div>
      
      <div class="content">
        <p>Dear ${clientName},</p>
        
        <p>Please find attached the service report for your recent pest control service.</p>
        
        ${customMessage ? `
          <div class="custom-message">
            <p><strong>Message from KPS Pest Control:</strong></p>
            <p>${customMessage}</p>
          </div>
        ` : ''}
        
        <table class="info-table">
          <tr>
            <td>Report Reference</td>
            <td>#${reportId}</td>
          </tr>
          <tr>
            <td>Service Date</td>
            <td>${serviceDate}</td>
          </tr>
          <tr>
            <td>Service Type</td>
            <td>${reportType}</td>
          </tr>
          <tr>
            <td>Technician</td>
            <td>${pcoName}</td>
          </tr>
        </table>
        
        <p>If you have any questions or concerns about this service report, please don't hesitate to contact us.</p>
        
        <p>Thank you for choosing KPS Pest Control.</p>
      </div>
      
      <div class="footer">
        <p><strong>KPS Pest Control</strong></p>
        <p>Email: design@dannel.co.za | Phone: 013 262 4798</p>
        <p>This is an automated email. Please do not reply directly to this message.</p>
      </div>
    </body>
    </html>
  `;
}
```

---

## PDF Generation

### Puppeteer Configuration

```typescript
// lib/pdf.ts
import puppeteer from 'puppeteer';

let browser: any = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
  }
  return browser;
}

export async function generateReportPDF(reportData: any): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  // Set HTML content
  const html = generateReportHTML(reportData);
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  // Generate PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      right: '10mm',
      bottom: '10mm',
      left: '10mm'
    }
  });
  
  await page.close();
  
  return pdf;
}

function generateReportHTML(report: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10pt; }
        .header { background: #2c3e50; color: white; padding: 20px; }
        .header h1 { font-size: 24pt; margin-bottom: 5px; }
        .section { margin: 20px 0; }
        .section-title { 
          background: #ecf0f1; 
          padding: 10px; 
          font-weight: bold; 
          margin-bottom: 10px;
          border-left: 4px solid #3498db;
        }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; font-weight: bold; }
        .signature { margin-top: 20px; max-width: 200px; border: 1px solid #ddd; padding: 10px; }
        .signature img { max-width: 100%; height: auto; }
        .new-equipment { background-color: #fff3cd; }
        .page-break { page-break-after: always; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KPS Pest Control</h1>
        <p>Service Report #${report.id}</p>
      </div>
      
      <div class="section">
        <div class="section-title">Service Information</div>
        <table>
          <tr>
            <td><strong>Client:</strong></td>
            <td>${report.client.companyName}</td>
            <td><strong>Service Date:</strong></td>
            <td>${report.serviceDate}</td>
          </tr>
          <tr>
            <td><strong>Address:</strong></td>
            <td>${report.client.address.line1}, ${report.client.address.city}</td>
            <td><strong>Next Service:</strong></td>
            <td>${report.nextServiceDate || 'Not scheduled'}</td>
          </tr>
          <tr>
            <td><strong>Technician:</strong></td>
            <td>${report.pco.fullName}</td>
            <td><strong>Report Type:</strong></td>
            <td>${report.reportType.toUpperCase()}</td>
          </tr>
        </table>
      </div>
      
      ${report.baitStations && report.baitStations.length > 0 ? `
        <div class="section">
          <div class="section-title">Bait Station Inspection</div>
          
          <h4>Inside Bait Stations</h4>
          <table>
            <thead>
              <tr>
                <th>Station #</th>
                <th>Accessible</th>
                <th>Activity</th>
                <th>Bait Status</th>
                <th>Condition</th>
                <th>Chemicals Used</th>
              </tr>
            </thead>
            <tbody>
              ${report.baitStations
                .filter((s: any) => s.location === 'inside')
                .map((station: any) => `
                  <tr class="${station.isNew ? 'new-equipment' : ''}">
                    <td>${station.stationNumber}${station.isNew ? ' ⭐ NEW' : ''}</td>
                    <td>${station.accessible ? 'Yes' : 'No'}</td>
                    <td>${station.activityPresent ? station.activityType : 'None'}</td>
                    <td>${station.baitStatus || '-'}</td>
                    <td>${station.stationCondition}</td>
                    <td>${station.chemicals.map((c: any) => 
                      `${c.chemicalName} (${c.quantity}${c.unit})`
                    ).join(', ') || 'None'}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
          
          <h4>Outside Bait Stations</h4>
          <table>
            <thead>
              <tr>
                <th>Station #</th>
                <th>Accessible</th>
                <th>Activity</th>
                <th>Bait Status</th>
                <th>Condition</th>
                <th>Chemicals Used</th>
              </tr>
            </thead>
            <tbody>
              ${report.baitStations
                .filter((s: any) => s.location === 'outside')
                .map((station: any) => `
                  <tr class="${station.isNew ? 'new-equipment' : ''}">
                    <td>${station.stationNumber}${station.isNew ? ' ⭐ NEW' : ''}</td>
                    <td>${station.accessible ? 'Yes' : 'No'}</td>
                    <td>${station.activityPresent ? station.activityType : 'None'}</td>
                    <td>${station.baitStatus || '-'}</td>
                    <td>${station.stationCondition}</td>
                    <td>${station.chemicals.map((c: any) => 
                      `${c.chemicalName} (${c.quantity}${c.unit})`
                    ).join(', ') || 'None'}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      ${report.fumigation ? `
        <div class="section">
          <div class="section-title">Fumigation Service</div>
          
          <table>
            <tr>
              <td><strong>Areas Treated:</strong></td>
              <td>${report.fumigation.areasTreated.join(', ')}</td>
            </tr>
            <tr>
              <td><strong>Target Pests:</strong></td>
              <td>${report.fumigation.targetPests.join(', ')}</td>
            </tr>
          </table>
          
          <h4>Chemicals Used</h4>
          <table>
            <thead>
              <tr>
                <th>Chemical Name</th>
                <th>Quantity</th>
                <th>Batch Number</th>
              </tr>
            </thead>
            <tbody>
              ${report.fumigation.chemicals.map((c: any) => `
                <tr>
                  <td>${c.chemicalName}</td>
                  <td>${c.quantity} ${c.unit}</td>
                  <td>${c.batchNumber || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${report.fumigation.monitors.length > 0 ? `
            <h4>Insect Monitors</h4>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Condition</th>
                  <th>Serviced</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${report.fumigation.monitors.map((m: any) => `
                  <tr class="${m.isNew ? 'new-equipment' : ''}">
                    <td>${m.monitorType.toUpperCase()}${m.isNew ? ' ⭐ NEW' : ''}</td>
                    <td>${m.monitorCondition}</td>
                    <td>${m.wasServiced ? 'Yes' : 'No'}</td>
                    <td>
                      ${m.monitorType === 'light' ? `
                        Light: ${m.lightCondition || 'N/A'}<br>
                        Glue Board: ${m.glueBoardReplaced ? 'Replaced' : 'Not replaced'}<br>
                        Tubes: ${m.tubesReplaced ? 'Replaced' : 'Not replaced'}
                      ` : '-'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          ${report.fumigation.generalRemarks ? `
            <p><strong>General Remarks:</strong></p>
            <p>${report.fumigation.generalRemarks}</p>
          ` : ''}
        </div>
      ` : ''}
      
      ${report.adminRecommendations ? `
        <div class="section">
          <div class="section-title">Recommendations</div>
          <p>${report.adminRecommendations}</p>
        </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">Signatures</div>
        <table>
          <tr>
            <td style="width: 50%;">
              <strong>Technician Signature:</strong>
              <div class="signature">
                <img src="${report.pcoSignature}" alt="PCO Signature" />
                <p style="margin-top: 10px;">${report.pco.fullName}</p>
              </div>
            </td>
            <td style="width: 50%;">
              <strong>Client Signature:</strong>
              <div class="signature">
                <img src="${report.clientSignature}" alt="Client Signature" />
                <p style="margin-top: 10px;">${report.clientName}</p>
                <p>Date: ${report.serviceDate}</p>
              </div>
            </td>
          </tr>
        </table>
      </div>
      
      <div class="section" style="text-align: center; color: #666; font-size: 9pt;">
        <p>KPS Pest Control | design@dannel.co.za | 013 262 4798</p>
        <p>This report was generated on ${new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `;
}
```

---

## Push Notifications

### Web Push Setup

```typescript
// lib/push.ts
import webpush from 'web-push';
import { query } from './db';

// Configure web push
webpush.setVapidDetails(
  'mailto:design@dannel.co.za',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  userId: number,
  title: string,
  message: string,
  data?: any
) {
  // Get user's push subscriptions
  const subscriptions = await query(
    'SELECT * FROM push_subscriptions WHERE user_id = ?',
    [userId]
  );
  
  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data
  });
  
  const promises = subscriptions.map((sub: any) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh_key,
        auth: sub.auth_key
      }
    };
    
    return webpush.sendNotification(pushSubscription, payload)
      .catch(error => {
        console.error('Push notification failed:', error);
        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        }
      });
  });
  
  await Promise.all(promises);
}

// Generate VAPID keys (run once)
export function generateVapidKeys() {
  return webpush.generateVAPIDKeys();
}
```

### Service Worker

```javascript
// public/service-worker.js
self.addEventListener('push', function(event) {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    data: data.data,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'view') {
    // Open specific page based on notification data
    const url = event.notification.data.url || '/';
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});
```

---

## Deployment

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_USER=kps_user
DB_PASSWORD=secure_password
DB_NAME=kps_database

# JWT
JWT_SECRET=your_secure_jwt_secret_here

# Email (SMTP)
SMTP_HOST=mail.kpspestcontrol.co.za
SMTP_PORT=587
SMTP_USER=noreply@kpspestcontrol.co.za
SMTP_PASS=email_password
SMTP_FROM=noreply@kpspestcontrol.co.za

# Push Notifications
VAPID_PUBLIC_KEY=your_public_vapid_key
VAPID_PRIVATE_KEY=your_private_vapid_key

# Application
NEXT_PUBLIC_API_URL=https://yourdomain.com
NODE_ENV=production
```

### cPanel Deployment

1. **Build Application**:
```bash
npm run build
```

2. **Create `.htaccess` for URL rewriting**:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^$ http://127.0 0.1:3000/ [P,L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
</IfModule>
```

3. **Setup Node.js Application in cPanel**:
   - Application Root: `/home/username/kps-next`
   - Application URL: your domain
   - Application Startup File: `server.js`
   - Node.js Version: 18+

4. **Create `server.js`**:
```javascript
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
```

5. **Start Application**:
   - Use cPanel Node.js selector to start the application
   - Or manually: `node server.js`

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificate installed
- [ ] SMTP credentials verified
- [ ] VAPID keys generated
- [ ] Build completed successfully
- [ ] Static assets optimized
- [ ] Error logging configured
- [ ] Backup strategy in place
- [ ] Monitoring setup

---

## Development Setup

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Initial Setup

1. **Clone repository**:
```bash
git clone <repository_url>
cd kps-next
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. **Setup database**:
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE kps_database;"

# Run migrations
mysql -u root -p kps_database < database/schema.sql
mysql -u root -p kps_database < database/seed.sql
```

5. **Generate VAPID keys**:
```bash
node scripts/generate-vapid-keys.js
# Add keys to .env.local
```

6. **Run development server**:
```bash
npm run dev
```

7. **Access application**:
   - Admin: http://localhost:3000/login (use admin12345)
   - PCO: http://localhost:3000/login (use pco12345)

### Database Migrations

Create new migration:
```bash
# Create file: database/migrations/YYYY-MM-DD-description.sql
```

Run migrations:
```bash
mysql -u root -p kps_database < database/migrations/2026-02-10-add-feature.sql
```

---

## Testing

### Unit Tests

```typescript
// __tests__/lib/validation.test.ts
import { describe, it, expect } from '@jest/globals';
import { loginSchema, createUserSchema } from '@/lib/validation';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const result = loginSchema.safeParse({
        loginId: 'admin12345',
        password: 'password123'
      });
      expect(result.success).toBe(true);
    });
    
    it('should reject empty loginId', () => {
      const result = loginSchema.safeParse({
        loginId: '',
        password: 'password123'
      });
      expect(result.success).toBe(false);
    });
  });
  
  describe('createUserSchema', () => {
    it('should validate correct user data', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        fullName: 'Test User',
        password: 'password123',
        role: 'pco'
      });
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid email', () => {
      const result = createUserSchema.safeParse({
        email: 'invalid-email',
        fullName: 'Test User',
        password: 'password123',
        role: 'pco'
      });
      expect(result.success).toBe(false);
    });
  });
});
```

### API Tests

```typescript
// __tests__/api/auth/login.test.ts
import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

describe('POST /api/auth/login', () => {
  it('should return token for valid credentials', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        loginId: 'admin12345',
        password: 'testpassword'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
  });
  
  it('should reject invalid credentials', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        loginId: 'admin12345',
        password: 'wrongpassword'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});
```

### Run Tests

```bash
npm test
npm run test:coverage
```

---

## Security Considerations

### Input Validation
- All user inputs validated with Zod schemas
- SQL injection prevented with prepared statements
- XSS prevented with React's automatic escaping

### Authentication
- JWT tokens with expiration
- Bcrypt password hashing (10 rounds)
- Account lockout after failed attempts
- Session management

### Authorization
- Role-based access control
- Middleware authentication checks
- Resource ownership validation

### Data Protection
- HTTPS only in production
- Secure HTTP-only cookies
- CORS configuration
- Rate limiting on API endpoints

### Secure Headers

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}
```

---

## Performance Optimization

### Database
- Indexed columns for common queries
- Connection pooling
- Query optimization
- Pagination for large datasets

### Frontend
- Code splitting
- Lazy loading components
- Image optimization (Next.js Image)
- Static page generation where possible

### Caching
- Redis for session storage (optional)
- Browser caching for static assets
- API response caching where appropriate

### Monitoring
- Error logging (Sentry recommended)
- Performance monitoring
- Database query analysis
- API response time tracking

---

## Appendix

### Database Backup Script

```bash
#!/bin/bash
# backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mysql"
DB_NAME="kps_database"
DB_USER="kps_user"
DB_PASS="password"

mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/kps_${DATE}.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "kps_*.sql.gz" -mtime +30 -delete
```

### Useful Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with test data
npm run db:backup        # Backup database

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

---

**Document End**

*This technical documentation is confidential and proprietary to Dannel Web Design. Unauthorized distribution is prohibited.*
