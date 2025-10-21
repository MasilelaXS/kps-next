# PCO Mobile App Layout

## Overview
The PCO Portal now has a true **mobile-first layout** with **bottom navigation** instead of a sidebar, following iOS and Android app design patterns.

## Layout Structure

### ✅ Mobile App Features
- **Fixed Header** at the top with logo, title, notifications, and profile
- **Bottom Navigation Bar** with 4 main tabs
- **No Sidebar** - completely removed
- **Full-screen content** - utilizes entire screen
- **Touch-optimized** - large tap targets (44x44px minimum)

## Components

### Header (Top)
```
┌─────────────────────────────────────┐
│ [Logo] PCO Portal    [Bell] [Avatar]│
└─────────────────────────────────────┘
```

**Features:**
- Fixed at top (always visible)
- 56px height (h-14)
- KPS logo + "PCO Portal" title
- Notification bell icon
- User avatar (links to profile)
- White background with bottom border

### Main Content (Middle)
```
┌─────────────────────────────────────┐
│                                     │
│         Scrollable Content          │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Features:**
- Scrollable area between header and bottom nav
- Padding: top (56px for header) + bottom (64px for nav)
- Full width with 16px horizontal padding
- Light gray background (bg-gray-50)

### Bottom Navigation (Bottom)
```
┌─────────────────────────────────────┐
│ [🏠]    [📋]    [📄]    [🏢]       │
│ Home   Tasks   Reports Clients     │
└─────────────────────────────────────┘
```

**Features:**
- Fixed at bottom (always visible)
- 64px height (h-16)
- 4 navigation items evenly spaced
- Active state: purple color + bold text
- Inactive: gray color
- Icons + labels
- Touch feedback (active:scale-95)
- White background with top border

## Navigation Items

| Icon | Label | Route | Description |
|------|-------|-------|-------------|
| LayoutDashboard | Dashboard | `/pco/dashboard` | Home screen with stats |
| ClipboardList | Assignments | `/pco/assignments` | Active client assignments |
| FileText | Reports | `/pco/reports` | Report management |
| Building2 | Clients | `/pco/clients` | Client list |

## Active State
When a tab is active:
- Icon: Purple color (text-purple-600)
- Icon: Thicker stroke (stroke-[2.5])
- Label: Purple color (text-purple-600)
- Label: Bold font (font-semibold)

## Inactive State
When a tab is inactive:
- Icon: Gray color (text-gray-500)
- Icon: Normal stroke (stroke-2)
- Label: Gray color (text-gray-500)
- Label: Medium font (font-medium)
- Touch feedback on tap (active:scale-95)

## Profile Page
Accessible via avatar in header:
- Route: `/pco/profile`
- Shows user information
- Logout button
- App version info

## Layout Code

### File: `src/components/PcoDashboardLayout.tsx`

```tsx
<div className="min-h-screen bg-gray-50 pb-16">
  {/* Header */}
  <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b">
    {/* Logo + Title + Actions */}
  </header>

  {/* Content */}
  <main className="pt-14 pb-20 px-4">
    {children}
  </main>

  {/* Bottom Nav */}
  <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t">
    {/* Navigation Items */}
  </nav>
</div>
```

## Spacing & Layout

### Z-Index Layers
- Bottom Nav: `z-30` (always on top)
- Header: `z-30` (always on top)
- Content: `z-0` (default)
- Modals/Overlays: `z-40+` (above fixed elements)

### Padding Strategy
```
Header:      h-14  (56px)
Bottom Nav:  h-16  (64px)

Content padding-top:     pt-14  (56px)  → clears header
Content padding-bottom:  pb-20  (80px)  → clears bottom nav + extra space
Content padding-x:       px-4   (16px)  → left/right margins
```

### Safe Area (iOS Notch)
For iPhone X and newer with notch/dynamic island:
```css
/* Add to tailwind.config.ts if needed */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

## Responsive Behavior

### Mobile (Default)
- Bottom navigation visible
- Full-width content
- Touch-optimized sizing

### Tablet/Desktop (Optional Enhancement)
Could add media queries to show sidebar on larger screens:
```tsx
className="md:hidden" // Hide bottom nav on desktop
className="hidden md:block" // Show sidebar on desktop
```

## Comparison: Admin vs PCO

| Feature | Admin Portal | PCO Portal |
|---------|-------------|------------|
| **Layout** | Desktop sidebar | Mobile bottom nav |
| **Navigation** | Left sidebar | Bottom bar |
| **Screen Usage** | Content with left margin | Full-screen content |
| **Device Target** | Desktop/Laptop | Mobile/Tablet |
| **Collapsible Menu** | Yes (expand/collapse) | No (always visible) |
| **Profile Access** | Sidebar bottom | Header avatar |

## Touch Interactions

### Tap Targets
All interactive elements meet minimum touch target size:
- **Minimum:** 44x44px (iOS HIG)
- **Bottom nav items:** 48px+ height
- **Icons:** 24x24px with padding
- **Buttons:** Full width or min 44px height

### Feedback
```tsx
// Scale down on press
className="active:scale-95 transition-transform"

// Color change on press
className="active:bg-purple-100"
```

## Implementation Checklist

- [x] Remove sidebar from PCO layout
- [x] Add fixed header with logo and actions
- [x] Add bottom navigation bar
- [x] Create 4 navigation tabs
- [x] Add active/inactive states
- [x] Add touch feedback animations
- [x] Create profile page
- [x] Update dashboard padding
- [ ] Create Assignments page
- [ ] Create Reports page
- [ ] Create Clients page

## Design Tokens

### Colors
```
Primary: purple-600 (#9333ea)
Secondary: blue-600 (#2563eb)
Active: purple-600
Inactive: gray-500
Background: gray-50
Card: white
Border: gray-200
```

### Spacing
```
Header Height: 56px (h-14)
Bottom Nav Height: 64px (h-16)
Content Padding: 16px (p-4)
Card Radius: 16px (rounded-2xl)
Icon Size: 24px (w-6 h-6)
```

### Typography
```
Header Title: text-lg font-semibold (18px, 600 weight)
Nav Label: text-xs font-medium (12px, 500 weight)
Nav Label Active: text-xs font-semibold (12px, 600 weight)
```

## Best Practices

1. **Always Visible Navigation** - Users always see where they are
2. **Large Touch Targets** - Easy to tap even in motion
3. **Clear Active State** - No confusion about current page
4. **Fixed Positioning** - Header and nav stay in place during scroll
5. **Smooth Transitions** - Subtle animations for better UX
6. **Consistent Spacing** - Same padding throughout app
7. **Icon + Label** - Both visual and text cues for navigation

## Accessibility

- ✅ Large touch targets (44px minimum)
- ✅ Clear active states
- ✅ Semantic HTML (`<nav>`, `<header>`, `<main>`)
- 🔄 TODO: Add ARIA labels
- 🔄 TODO: Add keyboard navigation
- 🔄 TODO: Add focus indicators

## Progressive Web App (PWA)

This layout is perfect for PWA:
- Native app feel
- Familiar navigation pattern
- Full-screen usage
- Touch-optimized
- Works offline (when PWA configured)
- Can be "Add to Home Screen"
