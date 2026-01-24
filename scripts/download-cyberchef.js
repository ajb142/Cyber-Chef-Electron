#!/usr/bin/env node
/**
 * Download the latest CyberChef release and prepare it for Electron packaging.
 * Cross-platform: uses extract-zip for Windows/Linux/macOS.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');

const GITHUB_API_URL = 'https://api.github.com/repos/gchq/CyberChef/releases/latest';
const ELECTRON_APP_DIR = path.join(__dirname, '..', 'electron', 'app');
const VERSION_FILE = path.join(__dirname, '..', 'electron', 'version.json');
const DOWNLOAD_DIR = path.join(__dirname, '..', '.temp-download');
const BUILD_DIR = path.join(__dirname, '..', 'build');

function httpsGetJSON(url) {
  return new Promise((resolve, reject) => {
    const options = { headers: { 'User-Agent': 'CyberChef-Electron-Builder' } };
    https.get(url, options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        return httpsGetJSON(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const options = { headers: { 'User-Agent': 'CyberChef-Electron-Builder' } };
    https.get(url, options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => fileStream.close(resolve));
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function removeDir(p) {
  if (fs.existsSync(p)) await fs.promises.rm(p, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d); else await fs.promises.copyFile(s, d);
  }
}

async function main() {
  try {
    console.log('🔍 Fetching latest CyberChef release...');
    const release = await httpsGetJSON(GITHUB_API_URL);
    const version = (release.tag_name || release.name || '').replace(/^v/, '');

    const zipAsset = release.assets.find(a => a.name.endsWith('.zip') && a.name.includes('CyberChef') && !a.name.includes('node'));
    if (!zipAsset) throw new Error('No suitable CyberChef ZIP asset found');

    await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });
    const zipPath = path.join(DOWNLOAD_DIR, zipAsset.name);

    console.log(`💾 Downloading ${zipAsset.name} ...`);
    await downloadFile(zipAsset.browser_download_url, zipPath);

    const extractDir = path.join(DOWNLOAD_DIR, 'extracted');
    await removeDir(extractDir);
    await fs.promises.mkdir(extractDir, { recursive: true });

    console.log('📂 Extracting...');
    await extract(zipPath, { dir: extractDir });

    // Determine source directory (some zips contain a single folder)
    let sourceDir = extractDir;
    const contents = await fs.promises.readdir(extractDir);
    if (contents.length === 1) {
      const probe = path.join(extractDir, contents[0]);
      if ((await fs.promises.stat(probe)).isDirectory()) sourceDir = probe;
    }

    console.log('🔧 Preparing electron/app ...');
    await removeDir(ELECTRON_APP_DIR);
    await fs.promises.mkdir(ELECTRON_APP_DIR, { recursive: true });
    await copyDir(sourceDir, ELECTRON_APP_DIR);
    
    // Remove LICENSE files to reduce size
    console.log('🗑️  Removing LICENSE files...');
    const { execSync } = require('child_process');
    try {
      execSync(`find "${ELECTRON_APP_DIR}" -name "*.LICENSE.txt" -delete`, { stdio: 'pipe' });
    } catch (err) {
      console.warn('⚠️  Could not remove LICENSE files');
    }

    // Rename main HTML to index.html if needed
    const htmlFiles = (await fs.promises.readdir(ELECTRON_APP_DIR)).filter(f => f.endsWith('.html'));
    if (htmlFiles.length === 0) throw new Error('No HTML file found in extracted CyberChef');
    const mainHtml = htmlFiles.find(f => f.startsWith('CyberChef')) || htmlFiles[0];
    if (mainHtml !== 'index.html') await fs.promises.rename(path.join(ELECTRON_APP_DIR, mainHtml), path.join(ELECTRON_APP_DIR, 'index.html'));

    // Write version metadata
    const versionData = {
      version,
      releaseDate: release.published_at || null,
      releaseName: release.name || null,
      sourceUrl: release.html_url,
      downloadedAt: new Date().toISOString()
    };
    await fs.promises.mkdir(path.dirname(VERSION_FILE), { recursive: true });
    await fs.promises.writeFile(VERSION_FILE, JSON.stringify(versionData, null, 2), 'utf8');
    console.log('💾 Wrote electron/version.json');

    // Copy and convert icons
    await fs.promises.mkdir(BUILD_DIR, { recursive: true });
    const iconCandidatesPng = [
      path.join(ELECTRON_APP_DIR, 'images', 'cyberchef-128x128.png'),
      path.join(ELECTRON_APP_DIR, 'images', 'icon-256.png'),
      path.join(ELECTRON_APP_DIR, 'images', 'icon.png'),
      path.join(ELECTRON_APP_DIR, 'images', 'logo-256.png'),
      path.join(ELECTRON_APP_DIR, 'images', 'logo.png'),
    ];
    
    let copiedPng = false;
    for (const c of iconCandidatesPng) {
      if (!copiedPng && fs.existsSync(c)) {
        await fs.promises.copyFile(c, path.join(BUILD_DIR, 'icon.png'));
        copiedPng = true;
        console.log(`🖼 Copied ${c} -> build/icon.png`);
        
        // Convert PNG to ICO for Windows
        try {
          const { execSync } = require('child_process');
          execSync(`npx png-to-ico "${c}" > "${path.join(BUILD_DIR, 'icon.ico')}"`, { stdio: 'pipe' });
          console.log(`🖼 Converted icon.png -> build/icon.ico`);
        } catch (err) {
          console.warn(`⚠️  Could not convert to ICO (install png-to-ico): ${err.message}`);
        }
        break;
      }
    }

    // Clean up
    await removeDir(DOWNLOAD_DIR);
    console.log(`\n✨ Prepared CyberChef v${version} for Electron.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) main();
