# Push Notifications Setup Guide

## Overview
This guide explains how to set up and use push notifications in the KPS Pest Control System.

---

## 🚀 Quick Setup

### 1. Generate VAPID Keys

Run this command to generate VAPID keys:

```bash
cd api
npx web-push generate-vapid-keys
```

You'll get output like:

```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr8qBDEKRjSgY0wRxDTy8UU

Private Key:
k-P9q5ZGYGb0L69Fiz5zHnJ4JHyMPn1FZhDOuW8bLb4

=======================================
```

### 2. Add to Environment Variables

Add these keys to your `api/.env` file:

```env
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr8qBDEKRjSgY0wRxDTy8UU
VAPID_PRIVATE_KEY=k-P9q5ZGYGb0L69Fiz5zHnJ4JHyMPn1FZhDOuW8bLb4
VAPID_SUBJECT=mailto:admin@kpspestcontrol.co.za
```

**Important**: Replace with YOUR generated keys, not the example above!

### 3. Run Database Migration

Create the push_subscriptions table:

```bash
mysql -u root -p kpspestcontrol_app < guides/push-notifications.sql
```

Or run the SQL directly:

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. Restart Server

```bash
cd api
npm run dev
```

Check logs for: `✓ Push notifications initialized with VAPID keys`

---

## 📱 How to Use (Frontend)

### Add to User Dashboard

Add the PushNotificationToggle component to any page:

```tsx
import PushNotificationToggle from '@/components/PushNotificationToggle';

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <PushNotificationToggle />
    </div>
  );
}
```

### User Flow

1. User clicks "Enable Notifications" button
2. Browser shows permission request
3. User clicks "Allow"
4. Subscription is sent to server
5. User receives confirmation
6. User can click "Test" to send a test notification
7. User can click "Disable" to stop receiving notifications

---

## 🔧 API Endpoints

### Get VAPID Public Key
```http
GET /api/push/vapid-public-key
```

**Response:**
```json
{
  "success": true,
  "publicKey": "BEl62iU..."
}
```

### Subscribe to Push Notifications
```http
POST /api/push/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### Unsubscribe from Push Notifications
```http
POST /api/push/unsubscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

### Send Test Notification
```http
POST /api/push/test
Authorization: Bearer <token>
```

---

## 🔔 When Notifications are Sent

Push notifications are automatically sent when:

1. **New Assignment** - PCO is assigned to a client
   - Title: "New Assignment"
   - Body: "You have been assigned to [Client Name]"
   - Opens: `/pco/schedule`

2. **Report Declined** - Admin declines a report
   - Title: "Report Declined"
   - Body: Admin's feedback message
   - Opens: `/pco/dashboard`

3. **Report Submitted** - PCO submits a report
   - Title: "New Report Submitted"
   - Body: "[PCO Name] submitted a report for [Client Name]"
   - Opens: `/admin/reports`

4. **Report Approved** - Admin approves a report
   - Title: "Report Approved"
   - Body: "Your report for [Client Name] has been approved"
   - Opens: `/pco/dashboard`

5. **Report Archived** - Admin archives a report
   - Title: "Report Archived"
   - Body: "Your report for [Client Name] has been archived"
   - Opens: `/pco/dashboard`

---

## 🛠️ Technical Details

### Backend Components

1. **pushNotificationService.ts** - Core push notification logic
   - `subscribeToPush()` - Store user subscription
   - `unsubscribeFromPush()` - Remove user subscription
   - `sendPushNotification()` - Send notification to user
   - `sendPushToMultipleUsers()` - Broadcast to multiple users

2. **pushRoutes.ts** - API endpoints
   - `/api/push/vapid-public-key` - Get public key
   - `/api/push/subscribe` - Subscribe user
   - `/api/push/unsubscribe` - Unsubscribe user
   - `/api/push/test` - Send test notification

3. **notificationController.ts** - Integration
   - `createNotification()` - Creates in-app notification AND sends push

### Frontend Components

1. **pushNotifications.ts** - Push manager utility
   - `subscribe()` - Subscribe to push
   - `unsubscribe()` - Unsubscribe from push
   - `isSubscribed()` - Check subscription status
   - `sendTestNotification()` - Send test

2. **PushNotificationToggle.tsx** - UI component
   - Shows subscription status
   - Enable/disable button
   - Test button
   - Permission status

3. **sw.js** - Service Worker
   - Listens for push events
   - Shows notifications
   - Handles notification clicks
   - Routes to appropriate pages

---

## 🧪 Testing

### Test Push Notifications

1. **Subscribe a User**
   ```bash
   # Login
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"login_id":"admin12345","password":"your_password"}'
   
   # Copy the token from response
   
   # On the frontend, click "Enable Notifications" button
   ```

2. **Send Test Notification**
   ```bash
   curl -X POST http://localhost:3001/api/push/test \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Trigger Real Notification**
   - Assign a PCO to a client (as admin)
   - Submit a report (as PCO)
   - Decline a report (as admin)
   - Approve a report (as admin)

### Check Logs

Backend logs will show:
```
[INFO] Push subscription created for user 5
[INFO] Push notification sent to user 5
[INFO] Notification created for user 5: New Assignment
```

### Troubleshooting

**"VAPID keys not configured"**
- Make sure VAPID keys are in `.env` file
- Restart the server after adding keys

**"Push notifications not supported"**
- Use HTTPS (required for push notifications)
- Or use localhost (works without HTTPS)
- Check browser compatibility

**"Notifications blocked"**
- User must enable notifications in browser settings
- Clear site data and try again

**No notification received**
- Check if user is subscribed: `GET /api/push/test`
- Check browser console for errors
- Check service worker is registered: DevTools > Application > Service Workers

**Subscription expires**
- Service automatically removes expired subscriptions
- User needs to re-subscribe

---

## 🌐 Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ Yes | ✅ Yes |
| Firefox | ✅ Yes | ✅ Yes |
| Safari | ✅ Yes (16.4+) | ✅ Yes (16.4+) |
| Edge | ✅ Yes | ✅ Yes |
| Opera | ✅ Yes | ✅ Yes |

**Note**: Requires HTTPS in production (localhost works without HTTPS for testing)

---

## 🔐 Security

- VAPID keys authenticate your server to push services
- Never expose VAPID private key
- Subscriptions are user-specific
- Automatic cleanup of expired subscriptions
- JWT authentication required for all endpoints

---

## 📊 Database Schema

```sql
push_subscriptions
├── id (INT, PRIMARY KEY)
├── user_id (INT, FOREIGN KEY → users.id)
├── endpoint (TEXT) - Push service endpoint
├── p256dh (VARCHAR(255)) - Encryption key
├── auth (VARCHAR(255)) - Authentication secret
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

---

## 🎯 Best Practices

1. **Always check permission status** before attempting to subscribe
2. **Handle errors gracefully** - show user-friendly messages
3. **Provide unsubscribe option** - let users opt out
4. **Test notifications** - use the test endpoint during development
5. **Monitor expired subscriptions** - service handles this automatically
6. **Use meaningful notification content** - clear titles and bodies
7. **Route to relevant pages** - notification clicks should go somewhere useful

---

## 🚀 Production Deployment

### 1. Generate Production VAPID Keys
```bash
npx web-push generate-vapid-keys
```

### 2. Add to Production Environment
- Add keys to production `.env` file
- Or set as environment variables in hosting platform

### 3. Enable HTTPS
- Push notifications require HTTPS in production
- Ensure your domain has valid SSL certificate

### 4. Test on Production
- Test with real users
- Monitor push notification logs
- Check for expired subscriptions

---

## 📈 Monitoring

Track push notification metrics:

```sql
-- Total subscriptions
SELECT COUNT(*) FROM push_subscriptions;

-- Subscriptions per user
SELECT user_id, COUNT(*) as subscription_count 
FROM push_subscriptions 
GROUP BY user_id;

-- Recent subscriptions
SELECT * FROM push_subscriptions 
ORDER BY created_at DESC 
LIMIT 10;

-- Old subscriptions (might be expired)
SELECT * FROM push_subscriptions 
WHERE updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

**Last Updated**: November 5, 2025  
**Version**: 1.0.0
