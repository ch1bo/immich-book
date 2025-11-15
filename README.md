# Immich Book

Create photo books from [Immich](https://immich.app/) albums.

> [!WARNING]
> This is merely a vibe coded proof of concept right now .. Don't judge me for code quality!

A web application that generates print-ready photo books from your Immich albums using the official Immich SDK.

## Features

### Connection & Browsing
- Connect to your Immich server with API key authentication
- Browse and select from all your albums
- Automatic reconnection to last used album

### Layout & Customization
- Justified layout using @immich/justified-layout-wasm
- Custom page sizes (A4, Letter, A3) and custom dimensions
- Adjustable layout parameters (margin, row height, spacing)
- Combine pages mode for dual-page spreads
- Per-album configuration with global fallback

### Photo Customization
- Drag borders to customize aspect ratios per photo
- Drag & drop to reorder photos
- Cycle description positions (bottom, top, left, right)
- Toggle dates and descriptions on/off
- Reset customizations individually or all at once
- Color-coded indicators for customized photos

### Preview & Export
- Live preview with actual page layout and dimensions
- Page break indicator in combined mode
- High-quality PDF export using @react-pdf/renderer
- Quick edit links to Immich asset pages
- Clean, responsive UI built with React and Tailwind CSS

## Quick Start

### Prerequisites

- An Immich server with API access
- An Immich API key (generate in: Account Settings → API Keys)

### Installation

```bash
npm install

# Configure development proxy (for CORS)
cp .env.example .env

npm start
```

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
   - The app will automatically reconnect to your last used album on reload

3. **Configure Page Layout**
   - **Page Setup**: Adjust width, height, and combine pages option
   - **Layout**: Configure margin, row height, and spacing
   - **Presentation**: Toggle exclude videos, show dates, and show descriptions

4. **Customize Individual Photos**
   - **Drag borders** (left/right edges) to adjust aspect ratio
   - **Drag & drop** photos to reorder them
   - **Click descriptions** to cycle position (bottom → top → left → right)
   - View customization indicators (blue = aspect ratio, green = reordered, purple = label position)
   - **Click Edit** button (on hover) to open asset in Immich

5. **Generate PDF**
   - Click "Generate PDF" to preview
   - Use the PDF viewer toolbar to download
   - Click "Back to Edit" to make changes

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
