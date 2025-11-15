# Immich Book

Create beautiful photo books from your [Immich](https://immich.app/) albums.

A web application that generates print-ready photo books from your Immich albums using the official Immich SDK.

## Why Immich Book?

Your photos are already organized in Immich albums. Immich Book turns those curated collections into professional-quality photo books you can print or share as PDFs.

- **Privacy-first**: Your photos stay on your server
- **No subscriptions**: Free and open source
- **Full control**: Customize every aspect of your photo book
- **Print anywhere**: Export high-quality PDFs to any print service

## Demo

<!-- TODO: Add screenshots/video demo here -->

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

## Getting Started

You will need:

- An Immich server with API access
- An Immich API key with the following permissions:
  - `album.read` - To browse and list albums
  - `asset.read` - To read asset metadata (descriptions, dates, etc.)
  - `asset.view` - To access photo thumbnails and images

### Creating an API Key

1. Log into your Immich instance
2. Go to **Account Settings** → **API Keys**
3. Click **New API Key**
4. Give it a descriptive name (e.g., "Immich Book")
5. Select the required permissions:
   - `album.read`
   - `asset.read`
   - `asset.view`
6. Click **Create**
7. Copy the API key (you won't be able to see it again!)

### Using the Hosted Version

> [!WARNING]
> **Security Notice:** When using the hosted instance, your API key may be captured by whoever controls that domain. Only proceed if you trust the hosting provider! Anyone who controls the hosting can potentially access all your photos through your API key. For maximum security, consider self-hosting.

**Official hosted instance:** https://ch1bo.github.io/immich-book

#### Enable CORS on Your Immich Server

To use the hosted version, you need to allow CORS requests from the hosted domain. Add this to your Immich server's nginx configuration (inside the `server` block or `location /api` block):

```nginx
# Allow CORS for the official hosted instance
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' 'https://ch1bo.github.io' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'x-api-key, Content-Type, Accept' always;
    add_header 'Access-Control-Max-Age' 1728000;
    add_header 'Content-Type' 'text/plain charset=UTF-8';
    add_header 'Content-Length' 0;
    return 204;
}

add_header 'Access-Control-Allow-Origin' 'https://ch1bo.github.io' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'x-api-key, Content-Type, Accept' always;
```

**Important:**
- Never use `Access-Control-Allow-Origin: *` (wildcard) - it's a security risk
- Only add CORS headers for domains you trust
- Reload nginx after changes: `sudo nginx -s reload`

### Self-Hosting (Recommended)

Self-hosting on the same domain as your Immich server is the most secure option and doesn't require CORS configuration.

First, build the application:
```bash
git clone https://github.com/ch1bo/immich-book.git
cd immich-book
npm install
npm run build
```

#### Option 1: Subdirectory Deployment

Deploy to a subdirectory of your Immich domain (e.g., `https://photos.example.com/book/`).

Configure nginx (or your reverse proxy):
```nginx
location /book/ {
    alias /path/to/immich-book/dist/;
    try_files $uri $uri/ /book/index.html;
}
```

Reload nginx, for example using `sudo nginx -s reload`

#### Option 2: Subdomain Deployment

Deploy to a subdomain (e.g., `https://book.photos.example.com/`).

Configure nginx (or your reverse proxy):
```nginx
server {
    server_name book.photos.example.com;
    root /path/to/immich-book/dist;
    try_files $uri $uri/ /index.html;

    # Add SSL configuration as needed
}
```

Reload nginx, for example using `sudo nginx -s reload`

#### Option 3: Docker (Coming Soon)

Docker support is planned for easier deployment.

### Using Immich Book

1. **Connect to Immich**
   - Visit [hosted](#using-the-hosted-version) or your own [self-hosted](#self-hosting-recommended) (recommended) instance of `immich-book`
   - Enter your Immich server URL (e.g., `https://immich.example.com`)
   - Enter your API key
   - Click "Connect"

2. **Select an Album**
   - Browse your albums
   - Click on an album to open it

3. **Configure Page Layout**
   - **Page Setup**: Adjust width, height, and combine pages option
   - **Layout**: Configure margin, row height, and spacing
   - **Presentation**: Toggle exclude videos, show dates, and show descriptions

4. **Customize Individual Photos**
   - **Drag borders** (left/right edges) to adjust aspect ratio
   - **Drag & drop** photos to reorder them
   - **Click descriptions** to cycle position (bottom → top → left → right)
   - View customization indicators (blue = aspect ratio, green = reordered, purple = label position)

5. **Generate PDF**
   - Click "Generate PDF" to preview
   - Use the PDF viewer toolbar to download
   - Click "Back to Edit" to make changes

## Development

Clone and install:
```bash
git clone https://github.com/ch1bo/immich-book.git
cd immich-book
npm install
```

Create a `.env` file to avoid CORS issues:
```bash
# .env
VITE_IMMICH_PROXY_TARGET=https://your-immich-server.com
```

Start the development server:
```bash
npm start
```

The app will be available at http://localhost:5173

Other commands:
```bash
npm run build       # Build for production (output in dist/)
npm run type-check  # Run TypeScript type checking
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

> [!NOTE]
> This is still a proof of concept with plenty of AI generated code and no tests.

## Acknowledgments

- [Immich](https://immich.app/) - For the amazing self-hosted photo management platform
- [@immich/justified-layout-wasm](https://www.npmjs.com/package/@immich/justified-layout-wasm) - For the layout algorithm
- [@react-pdf/renderer](https://react-pdf.org/) - For PDF generation capabilities

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means you are free to use, modify, and distribute this software, provided that:
- You disclose the source code of any modifications
- You license derivative works under AGPL-3.0
- You provide source code access to users interacting with the software over a network (e.g., SaaS deployments)

See the [LICENSE](LICENSE) file for the full terms.

Commercial licensing is available if you wish to use this software in a commercial product or service without the open source requirements of AGPL-3.0, contact us immich-book@ncoding.li

---

**Copyright © 2025 Sebastian Nagel**
