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
- 🖨️ Export to PDF using browser print dialog
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

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`

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

4. **Export to PDF**
   - Click "Print / Export PDF"
   - In the print dialog, select "Save as PDF"
   - Configure page size and margins as needed

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready to deploy to any static hosting service.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **@immich/sdk** - Official Immich TypeScript SDK

## Roadmap

See [PLAN.md](./PLAN.md) for the full feature roadmap including:
- Multiple layout options (masonry, justified)
- High-resolution image loading for print
- Print specifications (margins, bleeds, page sizes)
- Layout templates
- And more...
