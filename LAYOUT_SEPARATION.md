# Layout Separation Documentation

## Overview
The application now uses **separate layouts** for Admin and PCO portals to ensure proper role-based access control and prevent cross-portal access.

## Architecture

### Before (Shared Layout)
- Single `DashboardLayout` component with `role` prop
- Role validation inside the shared component
- Brief flash of wrong portal during redirect

### After (Separate Layouts)
- `DashboardLayout` - Admin portal only
- `PcoDashboardLayout` - PCO portal only
- No role prop needed
- Cleaner role validation
- No flash of incorrect portal

## Components

### 1. DashboardLayout (Admin Only)
**File:** `src/components/DashboardLayout.tsx`

**Features:**
- ✅ Admin-only access
- ✅ Automatic redirect to `/pco/dashboard` for PCO users
- ✅ Logout invalid users
- ✅ Shows "Admin Portal" in header
- ✅ Shows "Administrator" in user profile

**Navigation:**
- Dashboard → `/admin/dashboard`
- Clients → `/admin/clients`
- Schedule → `/admin/schedule`
- PCO Users → `/admin/users`
- Reports → `/admin/reports`
- Chemicals → `/admin/chemicals`

**Usage:**
```tsx
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminPage() {
  return (
    <DashboardLayout>
      {/* Admin content */}
    </DashboardLayout>
  );
}
```

### 2. PcoDashboardLayout (PCO Only)
**File:** `src/components/PcoDashboardLayout.tsx`

**Features:**
- ✅ PCO-only access
- ✅ Automatic redirect to `/admin/dashboard` for admin users
- ✅ Logout invalid users
- ✅ Shows "PCO Portal" in header
- ✅ Shows "PCO User" in user profile

**Navigation:**
- Dashboard → `/pco/dashboard`
- Assignments → `/pco/assignments`
- Reports → `/pco/reports`
- Clients → `/pco/clients`

**Usage:**
```tsx
import PcoDashboardLayout from '@/components/PcoDashboardLayout';

export default function PcoPage() {
  return (
    <PcoDashboardLayout>
      {/* PCO content */}
    </PcoDashboardLayout>
  );
}
```

## Access Control Logic

### DashboardLayout (Admin)
```typescript
// Check if user is admin
if (parsedUser.role !== 'admin') {
  if (parsedUser.role === 'pco') {
    router.push('/pco/dashboard');  // Redirect PCO to their portal
  } else {
    // Unknown role, logout
    localStorage.removeItem('kps_token');
    localStorage.removeItem('kps_user');
    router.push('/login');
  }
}
```

### PcoDashboardLayout (PCO)
```typescript
// Check if user is PCO
if (parsedUser.role !== 'pco') {
  if (parsedUser.role === 'admin') {
    router.push('/admin/dashboard');  // Redirect admin to their portal
  } else {
    // Unknown role, logout
    localStorage.removeItem('kps_token');
    localStorage.removeItem('kps_user');
    router.push('/login');
  }
}
```

## Rendering Protection

Both layouts include a guard to prevent rendering until validation is complete:

```typescript
if (!mounted || !user || user.role !== 'expected_role') {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>
  );
}
```

This ensures:
- ✅ No hydration mismatch errors
- ✅ No flash of incorrect portal
- ✅ Smooth loading state during validation
- ✅ Proper redirect before any content renders

## Updated Pages

### Admin Pages (Using DashboardLayout)
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/clients/page.tsx`
- `src/app/admin/schedule/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/reports/[id]/edit/page.tsx`
- `src/app/admin/chemicals/page.tsx`

### PCO Pages (Using PcoDashboardLayout)
- `src/app/pco/dashboard/page.tsx`
- Future: `src/app/pco/assignments/page.tsx`
- Future: `src/app/pco/reports/page.tsx`
- Future: `src/app/pco/clients/page.tsx`

## Testing Scenarios

### ✅ Admin User Accessing Admin Portal
1. Login as admin (admin12345)
2. Navigate to `/admin/dashboard`
3. Should see: "Admin Portal" header
4. Navigation shows admin menu items

### ✅ PCO User Accessing PCO Portal
1. Login as PCO (pco67890)
2. Navigate to `/pco/dashboard`
3. Should see: "PCO Portal" header
4. Navigation shows PCO menu items

### ✅ Admin Trying to Access PCO Portal
1. Login as admin
2. Navigate to `/pco/dashboard`
3. Should see: Loading spinner
4. Auto-redirect to `/admin/dashboard`
5. Never see "PCO Portal" text

### ✅ PCO Trying to Access Admin Portal
1. Login as PCO
2. Navigate to `/admin/dashboard`
3. Should see: Loading spinner
4. Auto-redirect to `/pco/dashboard`
5. Never see "Admin Portal" text

## Benefits

1. **Cleaner Code**
   - No role prop needed
   - Each layout is self-contained
   - Easier to maintain

2. **Better Security**
   - Stricter role validation
   - Automatic redirects
   - No cross-portal access

3. **Improved UX**
   - No flash of wrong portal
   - Smooth loading states
   - Clear role separation

4. **Scalability**
   - Easy to add new portals
   - Independent styling per portal
   - Separate navigation per role

## Console Logging

Both layouts log access attempts for debugging:

```
Access denied: User is admin, redirecting to correct portal
Access denied: User is pco, redirecting to correct portal
```

Check browser console to verify role validation is working correctly.
