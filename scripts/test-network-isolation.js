#!/usr/bin/env node
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

let testsPassed = 0, testsFailed = 0;
const record = (name, ok, detail='') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
  ok ? testsPassed++ : testsFailed++;
};

function staticBase() {
  return app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..', 'electron', 'app');
}

function enforceCSP() {
  const csp = [
    "default-src 'self';",
    "base-uri 'self';",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' data: blob:;",
    "font-src 'self' data:;",
    "worker-src 'self' blob:;",
    "child-src 'self' blob:;",
    "connect-src 'none';",
    "object-src 'none';",
    "media-src 'none';",
    "frame-src 'none'"
  ].join(' ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = Object.assign({}, details.responseHeaders);
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url || '';
    if (/^(https?|wss?):/i.test(url)) return callback({ cancel: true });
    callback({});
  });
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  enforceCSP();
  const idx = path.join(staticBase(), 'index.html');
  if (!fs.existsSync(idx)) { console.error('index.html not found. Run: npm run prepare:electron'); app.exit(1); return; }

  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: true } });
  await win.loadFile(idx);
  await new Promise(r => setTimeout(r, 800));

  try {
    const fetchRes = await win.webContents.executeJavaScript("(async()=>{try{await fetch('https://example.com');return {ok:true}}catch(e){return {ok:false,err:e.message}}})()");
    record('fetch() blocked', fetchRes.ok === false, fetchRes.ok ? 'allowed' : 'blocked');
  } catch (e) { record('fetch() blocked', true, 'exception'); }

  try {
    const xhrRes = await win.webContents.executeJavaScript("(async()=>new Promise(res=>{try{const x=new XMLHttpRequest();x.onerror=()=>res({ok:false,err:'error'});x.onload=()=>res({ok:true});x.timeout=1500;x.ontimeout=()=>res({ok:false,err:'timeout'});x.open('GET','https://api.github.com');x.send()}catch(e){res({ok:false,err:e.message})}}))()");
    record('XMLHttpRequest blocked', xhrRes.ok === false, xhrRes.ok ? 'allowed' : xhrRes.err);
  } catch (e) { record('XMLHttpRequest blocked', true, 'exception'); }

  try {
    const imgRes = await win.webContents.executeJavaScript("(async()=>new Promise(res=>{const i=new Image();i.onerror=()=>res({ok:false});i.onload=()=>res({ok:true});i.src='https://example.com/x.png';setTimeout(()=>res({ok:false}),1500)}))()");
    record('External image blocked', imgRes.ok === false, imgRes.ok ? 'allowed' : 'blocked');
  } catch (e) { record('External image blocked', true, 'exception'); }

  try {
    const wsRes = await win.webContents.executeJavaScript("(async()=>new Promise(res=>{try{const w=new WebSocket('wss://echo.websocket.events');w.onopen=()=>res({ok:true});w.onerror=()=>res({ok:false});setTimeout(()=>{try{w.close()}catch(_){ } if(!w||w.readyState!==1)res({ok:false})},1500)}catch(e){res({ok:false})}}))()");
    record('WebSocket blocked', wsRes.ok === false, wsRes.ok ? 'allowed' : 'blocked');
  } catch (e) { record('WebSocket blocked', true, 'exception'); }

  console.log(`\nSummary: ${testsPassed} passed, ${testsFailed} failed`);
  app.exit(testsFailed > 0 ? 1 : 0);
});
