# Immich Book

Create photo books from [Immich](https://immich.app/) albums.

> [!WARNING]
> This is merely a vibe coded proof of concept right now .. Don't judge me for code quality!

A web application that generates print-ready photo books from your Immich albums using the official Immich SDK.

## Features

- 🔐 Connect to your Immich server with API key authentication
- 📚 Browse and select from all your albums
- 🖼️ Display photos in customizable grid layouts (1-4 columns)
- 📝 Automatically show captions from asset descriptions
- 🖨️ Export to PDF using optimized browser print (with page preview)
- 🎨 Clean, responsive UI built with React and Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+
- An Immich server with API access
- An Immich API key (generate in: Account Settings → API Keys)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd immich-book

# Install dependencies
npm install

# Configure development proxy (for CORS)
cp .env.example .env
# Edit .env and set VITE_IMMICH_PROXY_TARGET to your Immich server URL
# Example: VITE_IMMICH_PROXY_TARGET=https://photos.example.com

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`

#### Development Configuration

To avoid CORS issues during development, create a `.env` file:

```bash
# .env
VITE_IMMICH_PROXY_TARGET=https://photos.ncoding.at
```

Replace `https://photos.ncoding.at` with your Immich server URL. The Vite dev server will proxy API requests to avoid CORS errors.

### Usage

1. **Connect to Immich**
   - Enter your Immich server URL (e.g., `https://immich.example.com`)
   - Enter your API key
   - Click "Connect"

2. **Select an Album**
   - Browse your albums
   - Click on an album to open it

3. **Customize Layout**
   - Adjust the number of columns (1-4)
   - Photos automatically show captions from descriptions

4. **Print or Save as PDF**
   - Configure page size (A4, Letter, A3), orientation, and margins
   - Click "Print / Save as PDF"
   - In the browser print dialog:
     - Select "Save as PDF" as the destination
     - Adjust page settings to match your configuration
     - Click "Save" to download your photo book PDF

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Production Deployment

**Important:** To avoid CORS issues in production, deploy the static build on the **same domain** as your Immich server:

**Option 1: Subdirectory (Recommended)**
Deploy to a subdirectory of your Immich domain:
- Example: `https://photos.example.com/book/`
- Configure your reverse proxy (nginx/Caddy) to serve the static files

**Option 2: Subdomain**
Deploy to a subdomain:
- Example: `https://book.photos.example.com/`
- Ensure both the main domain and subdomain share cookies/CORS settings

**Example nginx configuration:**
```nginx
location /book/ {
    alias /path/to/immich-book/dist/;
    try_files $uri $uri/ /book/index.html;
}
```

See [PLAN.md](./PLAN.md) for discussion about adding a backend proxy for cross-domain deployments.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **@immich/sdk** - Official Immich TypeScript SDK
- **@immich/justified-layout-wasm** - Blazingly fast justified layout algorithm
- **Browser Print API** - Native PDF generation via print dialog

## Roadmap

See [PLAN.md](./PLAN.md) for the full feature roadmap including:
- Multiple layout options (masonry, justified)
- High-resolution image loading for print
- Print specifications (margins, bleeds, page sizes)
- Layout templates
- And more...
