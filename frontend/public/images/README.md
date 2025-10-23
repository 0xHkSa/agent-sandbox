# 🎨 Go Hawaii Assets Guide

## **Folder Structure**

```
/frontend/public/images/
├── backgrounds/     - Hero images, section backgrounds
├── icons/          - UI icons, weather icons
└── logos/          - Brand logos, partner logos
```

## **Adding Your Assets**

### **1. Hero Background Images**
**Location:** `/frontend/public/images/backgrounds/`

**Recommended filenames:**
- `hero-ocean.jpg` or `hero-ocean.webp` - Main hero background
- `hero-waves.jpg` - Alternative hero image
- `section-beach.jpg` - Section backgrounds
- `section-surf.jpg` - Activity section backgrounds

**Specifications:**
- **Resolution:** Minimum 2000px wide (prefer 2560px or higher)
- **Format:** WebP (best) or JPEG
- **Size:** Under 500KB after compression
- **Aspect Ratio:** 16:9 or wider (21:9 works great)
- **Style:** Aerial ocean shots, dramatic coastlines, moody/muted tones

**Usage in code:**
```tsx
// After adding hero-ocean.jpg to backgrounds folder:
<div 
  className="absolute inset-0 bg-cover bg-center"
  style={{
    backgroundImage: "url('/images/backgrounds/hero-ocean.jpg')",
  }}
/>
```

### **2. Icons**
**Location:** `/frontend/public/images/icons/`

**Common needs:**
- `weather-sun.svg` - Sunny weather
- `weather-rain.svg` - Rainy weather
- `wave-icon.svg` - Surf conditions
- `wind-icon.svg` - Wind indicator
- `uv-icon.svg` - UV index

**Usage:**
```tsx
<img src="/images/icons/weather-sun.svg" alt="Sunny" className="w-6 h-6" />
```

### **3. Logos**
**Location:** `/frontend/public/images/logos/`

**Recommended:**
- `logo.svg` or `logo.png` - Main "Go Hawaii" logo
- `logo-white.svg` - White version for dark backgrounds
- `logo-icon.svg` - Icon-only version

## **Image Optimization Tips**

### **Before Adding Images:**

1. **Compress images:**
   - Use https://tinypng.com (PNG/JPEG)
   - Use https://squoosh.app (all formats)
   - Target: <500KB for backgrounds, <50KB for icons

2. **Convert to WebP:**
   - Better compression than JPEG
   - Supported by all modern browsers
   - Use Squoosh or CLI tools

3. **Resize for web:**
   - Backgrounds: 2560x1440 max
   - Icons: 512x512 max (or SVG)
   - Logos: 1024x1024 max (or SVG)

## **Current Image Usage in App**

### **Homepage (page.tsx):**
- **Hero background:** Currently using Unsplash placeholder
- **To update:** Add your image to `/backgrounds/` and update line 12-14:

```tsx
// Replace this:
backgroundImage: "url('https://images.unsplash.com/...')",

// With this:
backgroundImage: "url('/images/backgrounds/hero-ocean.jpg')",
```

## **Finding Free Images**

### **Recommended Sources (Free & No Attribution Required):**

**Unsplash:**
- https://unsplash.com/s/photos/hawaii-ocean-aerial
- https://unsplash.com/s/photos/waves-coastline
- High quality, completely free

**Pexels:**
- https://pexels.com/search/hawaii-beach/
- https://pexels.com/search/ocean-aerial/
- Great selection, all free

**Pixabay:**
- https://pixabay.com/images/search/hawaii/
- Free for commercial use

### **Search Terms:**
- "hawaii aerial ocean"
- "waves crashing rocks"
- "volcanic coastline"
- "ocean overhead view"
- "dramatic seascape"
- "moody ocean sunset"

## **How to Download and Add Images:**

### **Step 1: Download**
1. Go to Unsplash/Pexels
2. Search for your desired image
3. Download the **large size** (usually "Original" or "Large")

### **Step 2: Optimize**
1. Go to https://squoosh.app
2. Upload your downloaded image
3. Resize to 2560px width (if larger)
4. Choose WebP format
5. Adjust quality to ~80% (balance size/quality)
6. Download optimized image

### **Step 3: Add to Project**
1. Rename file descriptively (e.g., `hero-ocean.webp`)
2. Move to `/frontend/public/images/backgrounds/`
3. Update the code to reference your new image

### **Step 4: Update Code**
```tsx
// In frontend/app/page.tsx, line ~12-14:
<div 
  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
  style={{
    backgroundImage: "url('/images/backgrounds/hero-ocean.webp')",
  }}
>
```

## **Quick Start: Get Your First Background**

### **Option 1: Use This Exact Image**
1. Go to: https://unsplash.com/photos/aerial-photography-of-body-of-water-tZCrFpSNiIQ
2. Download "Original" size
3. Optimize with Squoosh (resize to 2560px, WebP format)
4. Save as `hero-ocean.webp` in `/backgrounds/`
5. Update page.tsx line 14

### **Option 2: Browse and Choose**
1. Browse Unsplash: https://unsplash.com/s/photos/hawaii-ocean
2. Pick an aerial or dramatic ocean shot
3. Follow steps above

## **Next.js Image Component (Advanced)**

For better performance, you can use Next.js `<Image>` component:

```tsx
import Image from 'next/image';

<Image
  src="/images/backgrounds/hero-ocean.webp"
  alt="Hawaiian ocean aerial view"
  fill
  className="object-cover"
  priority
  quality={90}
/>
```

**Benefits:**
- Automatic optimization
- Lazy loading
- Responsive images
- Better performance

## **Need Help?**

Just ask:
- "How do I add my ocean image?"
- "Update the hero background to use my new image"
- "Optimize this image I downloaded"

**Drop your images in the folders and let me know - I'll update the code to use them!** 🌊

