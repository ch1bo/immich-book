# Immich Photo Book Generator

## Project Overview

A web application that generates print-ready photo books from Immich albums, leveraging Immich's existing photo management, metadata, and layout capabilities.

## Why This Approach?

- **Photos already organized**: Albums are curated in Immich
- **Metadata available**: Captions/descriptions are stored with assets
- **API access**: Immich provides full API access to albums and assets
- **Layout inspiration**: Immich's album preview code already handles thumbnail layouts
- **Open source**: Can leverage and learn from existing Immich codebase

## Architecture

### Components

1. **Frontend Web App**
   - React or Vue-based single-page application
   - Connects to Immich API
   - Provides layout preview and customization
   - Generates print-ready PDF

2. **Immich API Integration**
   - Authentication via API key
   - Album and asset retrieval
   - Thumbnail/full-resolution image access
   - Metadata extraction

3. **Layout Engine**
   - Grid-based layouts optimized for print
   - Options: justified, masonry, square grid, custom
   - Caption placement and styling
   - Page break handling

4. **PDF Export**
   - High-quality output suitable for printing
   - Proper margins, bleeds, and print specs
   - CMYK color profile support (optional)

### ⚠️ CORS Considerations (TODO - Needs Decision)

**Current State (MVP):**

- Pure client-side React app
- Uses Vite dev proxy for development to bypass CORS
- **Production deployment requires same-domain hosting** (e.g., `https://immich.example.com/book/`)

**Future Options:**

1. **Keep Simple (Current)**: Deploy as static app on same domain as Immich (via reverse proxy)
   - Pros: Simple, no backend needed, cheap hosting
   - Cons: Requires access to Immich server/reverse proxy config

2. **Add Backend Proxy (Like ImmichFrame)**: Create Node.js/Express backend
   - Pros: Works anywhere, can add caching/features later
   - Cons: More complex deployment, need to run a server

3. **Hybrid**: Static frontend + optional proxy backend for cross-domain scenarios

**Recommendation**: Start with option 1 (same-domain deployment), add option 2 if community needs it.

### PDF Generation

- Using @react-pdf/renderer (based on pdfkit)
- React-based PDF generation
- High-quality output with full control
- Live preview with PDFViewer component
- Built-in download via toolbar

**Current State:**

- Layout calculated at 300 DPI for accuracy, converted to 72 DPI points for PDF output
- Live preview with PDFViewer component shows exact output
- Consistent rendering between web preview and PDF (matching fonts, sizes, colors)
- Support for custom page dimensions and combined page mode

**Remaining Limitations:**

- pdfkit (internal to react-pdf) produces 72 DPI output regardless of settings
- Phase 3: Fix pdfkit to support high-quality PDF/X output at 300 DPI
- Phase 3: Add proper print bleeds and color profiles

**Previous Approach:**

- Browser Print API + Print CSS - worked but lacked custom page size support

## Immich API Endpoints

### Authentication

```
POST /api/auth/login
Headers: API key or user credentials
```

### Album Operations

```
GET /api/albums
GET /api/albums/{albumId}
GET /api/albums/{albumId}/assets
```

### Asset Operations

```
GET /api/assets/{assetId}
GET /api/assets/{assetId}/thumbnail?size=preview
GET /api/assets/{assetId}/original
```

### Metadata

- Asset metadata includes: description, EXIF data, location, date
- Captions typically stored in `description` field

## Implementation Phases

### Phase 1: MVP (Minimum Viable Product)

- [x] Connect to Immich API with API key
- [x] List available albums
- [x] Select an album and load all assets
- [x] Display assets in justified layout (using @immich/justified-layout-wasm)
- [x] Show captions (dates and descriptions) from asset metadata
- [x] Page-based layout with custom dimensions
- [x] PDF export using @react-pdf/renderer with live preview
- [x] Support for standard page sizes (A4, Letter, A3) and custom dimensions
- [x] Adjustable layout parameters (margin, row height, spacing)
- [x] Combine pages feature (dual-page layout for print shops)

### Phase 2: Advanced Selection & Customization ✅ COMPLETED

- [x] Improved preview with actual page layout and dimensions
- [x] Filter assets (exclude videos toggle)
- [x] Customize row heights (adjustable parameter)
- [x] Re-arrange assets (drag & drop reordering with visual indicators)
- [x] Custom aspect ratios per photo (drag borders to adjust)
- [x] Description position cycling (bottom/top/left/right per photo)
- [x] Toggle dates and descriptions globally
- [x] Per-album configuration with global fallback
- [x] Customization indicators (color-coded dots: blue=aspect, green=order, purple=label)
- [x] Reset customizations (individual and bulk reset buttons)
- [x] Page break indicator for combined mode (subtle dashed line)
- [x] Edit button linking to Immich asset pages
- [x] Compact settings UI with organized sections (Page/Layout/Presentation)
- [x] Consistent fonts between preview and PDF (Helvetica)
- [x] Light gray background for left/right description boxes
- [x] Proper contrast with gray-200 background

**Note:** General sorting (date, name, etc.) was not implemented, but manual drag & drop reordering provides more powerful control.

### Phase 3: Print Quality

- [ ] Fix pdfkit to support high-quality PDF/X output at 300 DPI
- [ ] Proper print bleeds
- [ ] Color profile options (sRGB, CMYK)
- [ ] Quality settings

## Data Flow

1. **User Authentication**
   - User provides Immich URL and API key
   - App authenticates and stores credentials (local storage/session)

2. **Album Selection**
   - Fetch available albums from Immich
   - User selects target album
   - Load all assets with metadata

3. **Layout Preview**
   - Render assets in justified layout
   - Display captions from metadata
   - Allow customization like sort, filter and re-orderings
   - Live preview with target page size and margins

4. **PDF Generation**
   - Render final layout
   - Load high-resolution images
   - Generate PDF with proper specs

## Technical Considerations

### Image Quality

- Use high-resolution thumbnails or original images for print
- Minimum 300 DPI for quality prints
- Calculate required image dimensions based on page size

### Performance

- Lazy load images during preview
- Batch API requests
- Consider pagination for large albums
- Optimize image loading for PDF generation

### Browser Compatibility

- Test PDF generation across browsers
- Fallback options for older browsers
- Consider progressive web app (PWA) features

### Security

- Store API keys securely (not in localStorage for production)
- Validate Immich URL and API access
- Handle authentication errors gracefully

## Alternative Approaches

### Hybrid Approach

- Use Immich for photo management
- Export metadata to JSON
- Use external layout tool (Canva API, Adobe Express)

### Plugin for Immich

- Develop as Immich plugin/extension
- Integrate directly into Immich UI
- Could be contributed back to Immich project

## Print Service Integration (Future)

### Potential Services with APIs

- Blurb (PDF upload)
- Printful (API integration)
- Lulu (PDF upload)
- Local print shops

### Workflow

1. Generate PDF in app
2. Upload to print service via API
3. Configure book specs (cover, paper type, binding)
4. Order directly from app

## Resources

### Immich Documentation

- API Documentation: Check Immich GitHub/docs
- Source code: github.com/immich-app/immich
- Gallery layout code: Study `immich-app/immich/web/src/lib/components/photos-page/`

### PDF Generation

- Puppeteer: https://pptr.dev/
- jsPDF: https://github.com/parallax/jsPDF
- html2canvas: https://html2canvas.hertzen.com/

### Print Specs

- Standard book sizes and DPI requirements
- Bleed and margin specifications
- Color profiles (sRGB vs CMYK)

## Product Positioning & Marketing

### Inspiration: ImmichFrame Approach

ImmichFrame provides an excellent model for marketing an Immich community tool:

- **Clear value proposition**: "Turn your Immich albums into beautiful photo books"
- **Simple setup**: URL + API key (proven UX pattern in Immich ecosystem)
- **Multiple deployment options**: Web app, Docker, desktop apps, mobile
- **Beautiful presentation**: Focus on visual appeal and user experience
- **Community integration**: Part of the Immich ecosystem

### Product Name Ideas

- **Immich Book** - Simple, follows naming convention
- **Immich Photo Book Creator**
- **Album Press** (for Immich)
- **Immich Print Studio**
- **BookFrame** - Companion to ImmichFrame

### Target Audience

**Primary Users:**

- Immich users who want physical photo books
- Families wanting to preserve memories
- Event organizers (weddings, vacations, family reunions)
- People migrating from Google Photos who miss photo book features

**Use Cases:**

- Annual family photo books
- Vacation albums
- Baby's first year
- Wedding albums
- Gift photo books for grandparents
- Year-in-review books

### Value Propositions

1. **Privacy-First**: Keep your photos on your server, generate books locally
2. **Cost-Effective**: No subscription, export to any print service
3. **Customizable**: Full control over layout, captions, and design
4. **AI-Assisted**: Smart layouts that make your photos look great
5. **Integration**: Works seamlessly with your existing Immich setup

### Go-to-Market Strategy

**Phase 1: Community Launch**

- Share in Immich Discord/GitHub discussions
- Post on r/selfhosted, r/immich
- Add to awesome-immich list
- Focus on early adopter feedback

**Phase 2: Polish & Documentation**

- Professional landing page (like immichframe.online)
- Video tutorials
- Template gallery
- Print service integration guides

**Phase 3: Ecosystem Growth**

- Desktop apps (Electron) for Windows/Mac/Linux
- Mobile apps for on-device preview
- Print service partnerships (Blurb, Lulu API integration)
- Premium templates (optional paid add-on)

**Phase 4: Potential Business Model** (Optional)

- Core tool remains free and open source
- Premium templates marketplace
- Direct print integration service (handle upload/ordering)
- White-label for print services
- Support/hosting service for non-technical users

### Distribution Channels

**Free & Open Source:**

- GitHub repository
- Docker Hub
- npm package (if building CLI)
- Immich community showcase

**Web Hosting:**

- Self-hosted via Docker
- Optional hosted demo instance (read-only)
- Netlify/Vercel for static web version

**App Stores** (Future):

- Chrome Web Store (PWA)
- Microsoft Store
- Mac App Store
- Linux Snap/Flatpak

### Competitive Advantages

**vs. Traditional Photo Book Services:**

- Privacy: Photos never leave your control
- Cost: No per-book fees for digital exports
- Flexibility: Use any print service
- Integration: Works with your existing photo library

**vs. Manual PDF Creation:**

- Automated layouts
- Professional templates
- Batch processing
- Smart caption placement

**vs. Other Immich Tools:**

- Focused on one thing: beautiful photo books
- Print-optimized output
- Professional-grade PDF generation

### Key Features for Marketing

**Highlight in Landing Page:**

- ✨ One-click album import from Immich
- 🎨 AI-powered smart layouts
- 📝 Automatic caption placement from metadata
- 🖨️ Print-ready PDF export (300+ DPI)
- 🎯 Multiple layout templates
- 🔒 100% private - photos never uploaded
- 🆓 Free and open source
- ⚡ Fast setup (2 minutes)

### Community Engagement

**Build in Public:**

- Regular development updates
- Feature voting
- Open roadmap
- Contributor-friendly

**Content Marketing:**

- Blog posts: "Creating a Year-in-Review Photo Book from Immich"
- Tutorials: "Best Practices for Photo Book Layouts"
- Case studies: User stories and examples
- Comparison guides: "Photo Book Services vs. Self-Hosted"

### Success Metrics

**Community Adoption:**

- GitHub stars
- Docker pulls
- Active installations
- Community contributions

**User Satisfaction:**

- Feature requests addressed
- Bug reports resolved
- User testimonials
- Showcase submissions

### Partnerships & Integrations

**Print Services:**

- Partner with print-on-demand services
- Affiliate programs
- API integrations for one-click ordering

**Immich Ecosystem:**

- Feature in Immich newsletter
- Contribute to Immich docs
- Collaborate with other tool creators

## Next Steps

**Phase 1 & 2 Completed:**

1. ✅ Set up development environment
2. ✅ Create basic React app with Immich API connection
3. ✅ Implement album browsing and asset loading
4. ✅ Build justified layout with captions
5. ✅ Add PDF export functionality with live preview
6. ✅ Add extensive layout and customization options
7. ✅ Implement per-photo customizations (aspect ratio, reordering, label positions)

**Phase 3 & Beyond:**

1. Improve PDF quality (300 DPI output, proper bleeds, color profiles)
2. Add general sorting options (by date, name, etc.)
3. Add more filter options (date range, favorites, etc.)
4. Consider template system for common layouts
5. Launch beta version in Immich community
6. Gather feedback and iterate
7. Create landing page and documentation
8. Explore partnerships with print services

## Notes

- Start simple: MVP with basic grid and browser print
- Learn from Immich's existing gallery layout code
- Keep it open source with optional premium features
- Focus on beautiful output from day one
- Consider contributing back to Immich if useful
- Keep print specifications in mind from the start
- Test with real albums of varying sizes
- Build community early and often
