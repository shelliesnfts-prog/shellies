# Profile Page Skeleton - XP Bridge Fix

## Issue
The ProfilePageSkeleton was missing the XP Converter (XP Bridge) card skeleton, causing a layout shift when the actual component loaded.

## Problem Analysis

### Actual Profile Page Structure:
```
Grid (4 columns on desktop):
├── NFT Holdings (1 col)
├── Day Lock (1 col)
├── Week Lock (1 col)
├── Month Lock (1 col)
├── Daily Rewards (2 cols) ← Was showing as 4 cols in skeleton
└── XP Converter (2 cols) ← MISSING in skeleton
```

### Previous Skeleton Structure:
```
Grid (4 columns on desktop):
├── NFT Holdings (1 col)
├── Day Lock (1 col)
├── Week Lock (1 col)
├── Month Lock (1 col)
└── Daily Rewards (4 cols) ← WRONG: Should be 2 cols
    └── XP Converter MISSING ← PROBLEM
```

## Solution

### Fixed Skeleton Structure:
```
Grid (4 columns on desktop):
├── NFT Holdings (1 col)
├── Day Lock (1 col)
├── Week Lock (1 col)
├── Month Lock (1 col)
├── Daily Rewards (2 cols) ✅ FIXED
└── XP Converter (2 cols) ✅ ADDED
```

## Changes Made

### 1. Fixed Daily Claim Card Column Span
**Before:**
```tsx
<div className="sm:col-span-4 col-span-2">
```

**After:**
```tsx
<div className="sm:col-span-2 col-span-1">
```

### 2. Added XP Bridge Card Skeleton
**New Element:**
```tsx
{/* XP Bridge Card Skeleton */}
<div className="sm:col-span-2 col-span-1 h-full">
  <div className="h-full group relative overflow-hidden rounded-2xl border">
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-transparent" />
    <div className="relative p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-5 w-28 rounded animate-pulse" /> {/* Title: "XP Converter" */}
          <div className="h-3 w-48 rounded animate-pulse" /> {/* Subtitle: "Convert XP to points..." */}
        </div>
        <div className="p-2.5 rounded-xl animate-pulse">
          <div className="w-5 h-5" /> {/* Icon */}
        </div>
      </div>
      
      {/* Content */}
      <div className="space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-48 rounded animate-pulse" /> {/* "Available: X XP → Y points" */}
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" /> {/* Status dot */}
              <div className="h-3 w-24 rounded animate-pulse" /> {/* Status text */}
            </div>
          </div>
          <div className="h-3 w-40 rounded animate-pulse" /> {/* Additional info */}
        </div>
        <div className="h-12 w-full rounded-xl animate-pulse" /> {/* Convert button */}
      </div>
    </div>
  </div>
</div>
```

## XP Bridge Component Structure

The skeleton now matches the actual XPBridge component:

### Header Section:
- **Title:** "XP Converter"
- **Subtitle:** "Convert XP to points • Rate: 10 XP = 1 Point"
- **Icon:** Exchange arrows icon

### Content Section:
- **Balance Info:** "Available: X XP → Y points"
- **Status Indicator:** Dot + text ("Ready to convert" / "On cooldown" / "No XP available")
- **Additional Info:** Conversion details or cooldown timer
- **Convert Button:** Large button at the bottom

### Layout Features:
- Uses `h-full` to match parent height
- Uses `flex flex-col` with `justify-between` to space content
- Gradient background matching the theme
- Purple/pink accent colors

## Visual Comparison

### Before (Missing XP Bridge):
```
┌─────────────────────────────────────────────────┐
│ NFT Holdings │ Day Lock │ Week Lock │ Month Lock│
├─────────────────────────────────────────────────┤
│           Daily Rewards (Full Width)            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### After (With XP Bridge):
```
┌─────────────────────────────────────────────────┐
│ NFT Holdings │ Day Lock │ Week Lock │ Month Lock│
├─────────────────────────────────────────────────┤
│   Daily Rewards (Half)  │  XP Converter (Half)  │
│                         │                       │
└─────────────────────────────────────────────────┘
```

## Benefits

1. **No Layout Shift:** Skeleton matches actual layout perfectly
2. **Accurate Preview:** Users see where XP Converter will appear
3. **Consistent Grid:** Proper 2-column layout for both cards
4. **Professional UX:** Smooth loading experience
5. **Theme Support:** Works in both dark and light modes

## Files Modified

✅ `src/components/portal/ProfilePageSkeleton.tsx` - Added XP Bridge skeleton and fixed Daily Claim column span

## Testing Checklist

- [ ] Skeleton shows 4 stat cards in first row
- [ ] Skeleton shows Daily Rewards card (2 columns)
- [ ] Skeleton shows XP Converter card (2 columns)
- [ ] Both cards are side-by-side on desktop
- [ ] Both cards stack on mobile
- [ ] Skeleton matches actual component structure
- [ ] No layout shift when actual content loads
- [ ] Works in both light and dark mode
- [ ] Gradient backgrounds match theme
- [ ] All skeleton elements animate with pulse effect

## Notes

- The XP Bridge skeleton uses `h-full` to match the height of the Daily Rewards card
- The skeleton includes the same gradient background as the actual component
- Status indicator (dot + text) is included to match the actual UI
- Convert button skeleton is larger (h-12) to match the actual button size
