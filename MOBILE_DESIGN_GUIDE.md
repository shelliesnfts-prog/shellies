# Mobile Design Guide - Shellies Game Page

## 🎨 Design Philosophy

### Mobile-First Approach
1. **Content Prioritization**: Show only essential information
2. **Vertical Optimization**: Stack elements efficiently
3. **Touch-Friendly**: Minimum 44px touch targets
4. **Scannable**: Use emojis, short labels, clear hierarchy

### Progressive Enhancement
- Mobile: Core functionality, condensed content
- Tablet: Transition layout, more breathing room
- Desktop: Full experience, detailed information

---

## 📐 Layout Specifications

### Header Section
```
┌─────────────────────────────────────┐
│ 🎮 Shellies Game        [Best: 100]│  ← Horizontal, compact
│    Mario-inspired platformer        │  ← Hidden on mobile
└─────────────────────────────────────┘

Mobile:  text-lg, single line, compact badge
Desktop: text-3xl, subtitle visible, larger badge
```

### Desktop Recommendation (Mobile Only)
```
┌─────────────────────────────────────┐
│ ℹ️ Best played on desktop! This    │
│    game is optimized for keyboard   │
│    controls. Mobile experience may  │
│    be limited.                      │
└─────────────────────────────────────┘

Color: Blue info banner
Display: lg:hidden (mobile only)
Purpose: Set user expectations
```

### Payment Information Banner
```
MOBILE VIEW:
┌─────────────────────────────────────┐
│ ℹ️ Play Fee System Q&A          [×]│
│                                     │
│ 💰 Why the fee?                    │
│ Prevents bots, keeps gameplay fair  │
│                                     │
│ 🎨 Holder Benefits                 │
│ NFT holders 50% off • Stakers 80%  │
│                                     │
│ [Payment Tiers: 2 columns]         │
└─────────────────────────────────────┘

DESKTOP VIEW:
┌─────────────────────────────────────┐
│ ℹ️ Shellies Mario Game — Q&A    [×]│
│                                     │
│ Q: Why fee?        Q: Holders?     │
│ A: Prevents bots   A: Lower fees   │
│                                     │
│ Q: Public?         Q: Use of fees? │
│ A: Regular fee     A: Raffles...   │
│                                     │
│ [Payment Tiers: 4 columns]         │
└─────────────────────────────────────┘
```

### Payment Tier Cards

#### Mobile (2 columns)
```
┌──────────────┬──────────────┐
│ REGULAR      │ NFT HOLDER   │
│ Price        │ Your NFTs: 5 │
│ $0.0050      │ Price        │
│ 0.000001 ETH │ $0.0025      │
│              │ 0.0000005ETH │
│              │ 🎮 Play      │
└──────────────┴──────────────┘
┌──────────────┬──────────────┐
│ STAKER       │ (empty)      │
│ Staked: 3    │              │
│ Price        │              │
│ $0.0010      │              │
│ 0.0000002ETH │              │
│ 🎮 Play      │              │
└──────────────┴──────────────┘

Sizing: p-2, text-xs, compact
Button: py-1.5, text-xs
```

#### Desktop (4 columns)
```
┌────────┬────────┬────────┬────────┐
│REGULAR │NFT     │STAKER  │(empty) │
│        │HOLDER  │        │        │
│Price   │Your    │Your    │        │
│$0.0050 │NFTs: 5 │Staked:3│        │
│        │Price   │Price   │        │
│        │$0.0025 │$0.0010 │        │
│        │🎮 Play │🎮 Play │        │
│        │Now     │Now     │        │
└────────┴────────┴────────┴────────┘

Sizing: p-4, text-sm, spacious
Button: py-2, text-base
```

### Game Console

#### Mobile (< 1024px)
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│                                     │
│         GAME IFRAME                 │
│         400px FIXED                 │
│         HEIGHT                      │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘

Height: 400px (fixed)
Width: 100% (responsive)
Reason: Ensures game is visible
```

#### Desktop (≥ 1024px)
```
┌─────────────────────────────────────┐
│                                     │
│         GAME IFRAME                 │
│         1282:532 ASPECT             │
│         MIN 400px HEIGHT            │
│                                     │
└─────────────────────────────────────┘

Aspect: 1282:532 (original)
Max Width: 1282px
Min Height: 400px
```

### Game Controls

#### Mobile (2 columns)
```
┌──────────────┬──────────────┐
│ ⬇⬅➡ Arrows  │ ␣ Space      │
│     Move     │   Jump       │
├──────────────┼──────────────┤
│ Shift Shift  │ Ctrl Ctrl    │
│       Run    │      Fire    │
└──────────────┴──────────────┘

Icons: w-7 h-7
Text: text-xs
Padding: p-3
```

#### Desktop (4 columns)
```
┌────────┬────────┬────────┬────────┐
│⬇⬅➡    │␣       │Shift   │Ctrl    │
│Arrow   │Space   │Shift   │Ctrl    │
│Keys    │Jump    │Run     │Fire    │
│Move    │        │        │        │
└────────┴────────┴────────┴────────┘

Icons: w-10 h-10
Text: text-sm
Padding: p-6
```

---

## 🎯 Responsive Breakpoints

### Spacing Scale
```
Property    Mobile  SM      LG      XL
─────────────────────────────────────
gap         2       3       4       4
padding     2.5     3       4       6
space-y     3       4       6       6
```

### Typography Scale
```
Element     Mobile  SM      LG      XL
─────────────────────────────────────
H1          lg      2xl     3xl     3xl
H2          sm      lg      2xl     3xl
H3          sm      base    lg      lg
Body        xs      sm      base    base
Label       xs      xs      xs      xs
Button      xs      sm      base    base
```

### Icon Scale
```
Element     Mobile  SM      LG
──────────────────────────────
Header      w-5     w-5     w-6
Info        w-4     w-5     w-6
Controls    w-7     w-8     w-10
Tier Badge  w-4     w-5     w-6
```

---

## 🎨 Color Scheme

### Info Banners
```css
/* Desktop Recommendation (Mobile) */
bg: blue-900/20 (dark) | blue-50 (light)
border: blue-700/50 (dark) | blue-200 (light)
text: blue-200 (dark) | blue-800 (light)

/* Payment Info Banner */
bg: purple-900/20 to pink-900/20 (dark)
    purple-50 to pink-50 (light)
border: purple-700/50 (dark) | purple-200 (light)
```

### Tier Cards
```css
/* Active Tier (User's tier) */
bg: purple-900/40 to pink-900/40 (dark)
    purple-50 to pink-50 (light)
border: purple-600/50 (dark) | purple-300 (light)

/* Inactive Tier */
bg: gray-800 to gray-900 (dark)
    white to gray-50 (light)
border: gray-700 (dark) | gray-200 (light)
```

### Buttons
```css
/* Staker Tier */
bg: purple-600 to pink-600
hover: purple-700 to pink-700

/* NFT Holder Tier */
bg: blue-600 to indigo-600
hover: blue-700 to indigo-700

/* Regular Tier */
bg: gray-600 to gray-700
hover: gray-700 to gray-800
```

---

## 📱 Touch Target Guidelines

### Minimum Sizes
```
Element         Min Width   Min Height
────────────────────────────────────
Button          44px        44px
Close Button    40px        40px
Tier Card       140px       120px
Control Icon    28px        28px
```

### Spacing Between Targets
```
Context         Gap
─────────────────────
Tier Cards      8px (gap-2)
Buttons         12px (gap-3)
Controls        8px (gap-2)
```

---

## 🔤 Content Guidelines

### Mobile Content Rules
1. **Shorten labels**: "Arrow Keys" → "Arrows"
2. **Use emojis**: Add visual hierarchy (💰, 🎨, ℹ️)
3. **Condense text**: Remove unnecessary words
4. **Bullet points**: Use • for lists
5. **Numbers only**: "Your NFTs: 5" → "5"

### Desktop Content Rules
1. **Full labels**: "Arrow Keys", "Price per Game"
2. **Complete sentences**: Full explanations
3. **Detailed Q&A**: Multi-paragraph answers
4. **Descriptive buttons**: "🎮 Play Now"

---

## ✅ Quality Checklist

### Visual Quality
- [ ] No text smaller than 12px (text-xs)
- [ ] Adequate contrast ratios (WCAG AA)
- [ ] Consistent spacing throughout
- [ ] Aligned elements in grids
- [ ] Proper icon sizing

### Functional Quality
- [ ] All buttons tappable (≥44px)
- [ ] No horizontal scroll
- [ ] Smooth scrolling to game
- [ ] Close buttons work
- [ ] Responsive images/iframes

### Content Quality
- [ ] Mobile: Condensed, scannable
- [ ] Desktop: Detailed, informative
- [ ] Clear hierarchy
- [ ] Proper grammar
- [ ] Consistent terminology

### Performance Quality
- [ ] No layout shift
- [ ] Fast loading
- [ ] Smooth animations
- [ ] Efficient rendering
- [ ] No unnecessary re-renders

---

## 🚀 Implementation Tips

### 1. Use Tailwind's Responsive Prefixes
```tsx
className="text-xs sm:text-sm lg:text-base"
```

### 2. Conditional Rendering for Different Content
```tsx
{/* Mobile */}
<div className="lg:hidden">Mobile content</div>

{/* Desktop */}
<div className="hidden lg:block">Desktop content</div>
```

### 3. Separate Containers for Different Layouts
```tsx
{/* Mobile game console */}
<div className="lg:hidden" style={{ height: '400px' }}>
  <iframe ... />
</div>

{/* Desktop game console */}
<div className="hidden lg:block" style={{ aspectRatio: '1282/532' }}>
  <iframe ... />
</div>
```

### 4. Progressive Spacing
```tsx
className="p-2 sm:p-3 lg:p-4 xl:p-6"
className="gap-2 sm:gap-3 lg:gap-4"
className="space-y-2 sm:space-y-3 lg:space-y-4"
```

---

## 📊 Success Metrics

### User Experience
- ✅ Game is visible and playable on mobile
- ✅ Information is easy to scan
- ✅ No frustration with tiny text
- ✅ Clear expectations set (desktop notice)

### Technical
- ✅ No horizontal scroll on any device
- ✅ Proper touch targets (≥44px)
- ✅ Responsive typography
- ✅ Efficient space usage

### Business
- ✅ Users understand payment tiers
- ✅ Clear call-to-action buttons
- ✅ Professional mobile appearance
- ✅ Reduced bounce rate on mobile

---

**Remember**: Mobile users should feel the page was designed FOR them, not just adapted to their screen size! 📱✨
