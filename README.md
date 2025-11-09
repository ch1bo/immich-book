# Immich Book

Create photo books from [Immich](https://immich.app/) albums.

> [!WARNING]
> This is merely a vibe coded proof of concept right now .. Don't judge me for code quality!

A web application that generates print-ready photo books from your Immich albums using the official Immich SDK.

## Features

- 🔐 Connect to your Immich server with API key authentication
- 📚 Browse and select from all your albums
- 🖼️ Display photos in a customizable layouts (similar to normal Immich view)
- 📝 Automatically show captions from asset descriptions
- 🖨️ Export to PDF with page preview
- 🎨 Clean, responsive UI built with React and Tailwind CSS

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
