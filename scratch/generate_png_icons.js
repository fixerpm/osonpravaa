const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SVG_CONTENT = fs.readFileSync(path.join(ROOT_DIR, 'favicon.svg'), 'utf8');

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Render Favicons</title></head>
<body>
<h2>Rendering favicons...</h2>
<div id="status">Starting...</div>
<script>
async function generate() {
  const sizes = [512, 192, 32, 16];
  const svgText = ${JSON.stringify(SVG_CONTENT)};
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = async () => {
    const results = {};
    for (const size of sizes) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      results['favicon-' + size + '.png'] = canvas.toDataURL('image/png').split(',')[1];
    }
    document.getElementById('status').innerText = 'Posting...';
    const res = await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results)
    });
    const resJson = await res.json();
    document.getElementById('status').innerText = 'DONE: ' + JSON.stringify(resJson);
  };
  img.src = url;
}
generate();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (req.url === '/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        for (const [filename, b64] of Object.entries(data)) {
          const filePath = path.join(ROOT_DIR, filename);
          fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
          console.log('Saved:', filename, 'size:', fs.statSync(filePath).size, 'bytes');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, files: Object.keys(data) }));
        setTimeout(() => {
          console.log('Finished icon generation.');
          process.exit(0);
        }, 500);
      } catch (e) {
        console.error('Error saving icons:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(4829, () => {
  console.log('Icon render server running at http://localhost:4829');
});
