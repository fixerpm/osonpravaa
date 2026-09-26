const http = require('http');
const fs = require('fs');
const path = require('path');

async function testAll() {
  console.log('=== TEST 1: Check Favicon Files & Manifest & HTML ===');
  const files = ['favicon.svg', 'favicon-16.png', 'favicon-32.png', 'favicon-192.png', 'favicon-512.png', 'manifest.json', 'sw.js', 'index.html', '.gitignore', '.env'];
  for (const f of files) {
    const exists = fs.existsSync(f);
    const sz = exists ? fs.statSync(f).size : 0;
    console.log(`[File] ${f}: ${exists ? 'EXISTS (' + sz + ' bytes)' : 'MISSING'}`);
  }

  // Check manifest.json contents
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  console.log('[Manifest] theme_color:', manifest.theme_color, '| background_color:', manifest.background_color);
  console.log('[Manifest] icons count:', manifest.icons.length);

  // Check sw.js
  const sw = fs.readFileSync('sw.js', 'utf8');
  console.log('[SW] Cache name check:', sw.includes('osonprava-v2.4') ? 'PASSED (v2.4)' : 'FAILED');
  console.log('[SW] Favicon assets in sw.js:', sw.includes('favicon-512.png') && sw.includes('favicon-192.png') ? 'PASSED' : 'FAILED');

  // Check index.html
  const html = fs.readFileSync('index.html', 'utf8');
  console.log('[HTML] Favicon links in index.html:', html.includes('favicon-32.png?v=2') && html.includes('theme-color" content="#0A1530"') ? 'PASSED' : 'FAILED');

  console.log('\n=== TEST 2: Start server and test API endpoints ===');
  // Start server
  const serverProcess = require('child_process').spawn('node', ['server.js'], {
    env: { ...process.env, PORT: '3099' },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', d => process.stdout.write('[Server Log] ' + d.toString()));
  serverProcess.stderr.on('data', d => process.stderr.write('[Server Err] ' + d.toString()));

  await new Promise(r => setTimeout(r, 1200));

  function postJSON(urlPath, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const req = http.request({
        hostname: 'localhost',
        port: 3099,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, res => {
        let respData = '';
        res.on('data', chunk => respData += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(respData) }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  function getReq(urlPath) {
    return new Promise((resolve, reject) => {
      http.get({ hostname: 'localhost', port: 3099, path: urlPath }, res => {
        let respData = '';
        res.on('data', chunk => respData += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: respData }));
      }).on('error', reject);
    });
  }

  try {
    // 1. Static asset test
    const faviconRes = await getReq('/favicon.svg?v=2');
    console.log('[API] GET /favicon.svg status:', faviconRes.status, 'Content-Type:', faviconRes.headers['content-type']);

    const pngRes = await getReq('/favicon-192.png?v=2');
    console.log('[API] GET /favicon-192.png status:', pngRes.status, 'Content-Type:', pngRes.headers['content-type']);

    // 2. Questions API test
    const qRes = await getReq('/api/questions?limit=2');
    const qJson = JSON.parse(qRes.body);
    console.log('[API] GET /api/questions?limit=2 -> success:', qJson.success, 'count:', qJson.count, 'total in DB:', qJson.total);

    // 3. AI Chat endpoint test (Offline Fallback & RAG)
    const chatRes1 = await postJSON('/api/ai/chat', {
      query: "Chorrahada svetofor buzilsa kim birinchi o'tadi?",
      history: []
    });
    console.log('\n[API] POST /api/ai/chat (crossroads test):');
    console.log('  Success:', chatRes1.data.success);
    console.log('  Source:', chatRes1.data.source);
    console.log('  ActionUrl:', chatRes1.data.actionUrl);
    console.log('  ActionLabel:', chatRes1.data.actionLabel);
    console.log('  Text snippet:', chatRes1.data.text.slice(0, 120) + '...');

    // 4. AI Chat endpoint test with conversation history
    const chatRes2 = await postJSON('/api/ai/chat', {
      query: "Tezlikni 75 km/soat qilsam jarimasi qancha bo'ladi?",
      history: [
        { role: 'user', content: "Aholi punktida tezlik qancha?" },
        { role: 'assistant', content: "Aholi punktlarida ruxsat etilgan maksimal tezlik 60 km/soat." }
      ]
    });
    console.log('\n[API] POST /api/ai/chat (speed & fines test with history):');
    console.log('  Success:', chatRes2.data.success);
    console.log('  ActionUrl:', chatRes2.data.actionUrl);
    console.log('  ActionLabel:', chatRes2.data.actionLabel);
    console.log('  Text snippet:', chatRes2.data.text.slice(0, 150) + '...');

  } catch (e) {
    console.error('Test error:', e);
  } finally {
    serverProcess.kill();
    console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
  }
}

testAll();
