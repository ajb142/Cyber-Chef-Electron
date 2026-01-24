# CyberChef Electron Offline Build

A one-click offline Electron build for [CyberChef](https://gchq.github.io/CyberChef/) with network isolation and Content Security Policy (CSP) enforcement.

Whilst the cybechef tool is completly browser based and does not make any outbound connections, this serves as an extra layer of protection to those who may want to put sensitiv information into the tool.

This is also an alternative to the docker image approach provided by the cyberchef project.

## Features

- **Offline-First**: Automatically downloads the latest CyberChef release and bundles it with Electron
- **Network Isolated**: CSP enforced to prevent network access
- **Cross-Platform**: Builds for Windows, Linux, and macOS
- **Optimized**: Compressed installers with minimal size footprint
- **One-Click Building**: Simple npm scripts to prepare and build
- **Auto-Updates**: Tracks CyberChef version metadata for future update capability

## Quick Start

### Prerequisites

- Node.js 14+ and npm
- For Windows builds: NSIS (electron-builder will handle it)
- For Linux builds: Standard build tools

### Installation

```bash
npm install
```

### Development

Run the app in development mode:

```bash
npm run electron:dev
```

This will:
1. Download the latest CyberChef release
2. Launch the Electron app

### Building

#### Windows (NSIS + Portable)
```bash
npm run electron:build:win
```

Creates:
- `CyberChef Setup X.X.X.exe` - NSIS installer
- `CyberChef X.X.X.exe` - Portable executable

#### Linux (AppImage)
```bash
npm run electron:build:linux
```

Creates:
- `CyberChef-X.X.X.AppImage` - Portable Linux application

### Testing

Verify network isolation is working:

```bash
npm run test:network-isolation
```

## Project Structure

```
.
├── electron-main.js              # Electron main process
├── package.json                  # Dependencies & build config
├── build/
│   ├── icon.png                  # Linux app icon
│   └── icon.ico                  # Windows app icon
├── electron/
│   ├── app/                      # CyberChef web app (auto-downloaded)
│   ├── version.json              # Version metadata
├── scripts/
│   ├── download-cyberchef.js    # Download & prepare CyberChef
│   └── test-network-isolation.js # Network isolation tests
└── dist/
    └── electron/                 # Build output
```

## Configuration

### Icon Customization

Icons are automatically extracted from the CyberChef bundle during `prepare:electron`. To use custom icons:

1. Replace `build/icon.png` (Linux) and `build/icon.ico` (Windows)
2. Icons are automatically detected from CyberChef's `images/` directory

### Network Isolation

CSP headers are enforced to prevent any network access. The app works entirely offline after download.

## Package Contents

The resulting installer includes:

- CyberChef web application (latest release)
- Electron runtime (~150MB)
- App icons and metadata
- Version information for tracking

**Typical Installer Sizes:**
- Windows NSIS: ~80-100MB
- Windows Portable: ~120-140MB  
- Linux AppImage: ~100-120MB

## Development Notes

### Preparing CyberChef

The `prepare:electron` script (run automatically before each build):

1. Fetches the latest CyberChef release from GitHub
2. Extracts the ZIP archive
3. Removes LICENSE.txt files to reduce size
4. Extracts and converts the app icon
5. Records version metadata

### Main Process Features

- Single-window Electron app
- No external network access via CSP
- Preload script for security

## Troubleshooting

### Build fails: "Icon not found"
The icon extraction may have failed. Check that CyberChef was downloaded correctly:
```bash
ls -la electron/app/images/
```

### App won't launch offline
Ensure network isolation test passes:
```bash
npm run test:network-isolation
```


## Contributing

Feel free to submit issues or improvements!

## References

- [CyberChef](https://github.com/gchq/CyberChef) - Main project
- [Electron](https://www.electronjs.org/) - Framework
- [Electron Builder](https://www.electron.build/) - Build tool
