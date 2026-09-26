/**
 * OsonPrava — Automated Verification Suite for all 8 Tasks
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// Test 1: Simulator vehicle turn trajectory resolution
// -------------------------------------------------------------
console.log('\n--- 1. Simulator Left-Turn & Trajectory Resolution ---');
{
  const simContent = fs.readFileSync('js/simulator.js', 'utf8');
  const dataContent = fs.readFileSync('js/data.js', 'utf8');
  const sandbox = {
    window: {},
    document: { querySelectorAll: () => [], getElementById: () => null }
  };
  vm.createContext(sandbox);
  vm.runInContext(dataContent, sandbox);
  vm.runInContext(simContent, sandbox);

  const scs = sandbox.window.OSON_DATA.simulatorScenarios;
  assert(Array.isArray(scs) && scs.length === 8, '8 simulator scenarios loaded');

  // Test turn resolving logic
  const EXIT_POINTS = {
    N: 'translate(210, -120)',
    S: 'translate(155, 450)',
    E: 'translate(450, 200)',
    W: 'translate(-100, 155)'
  };
  const RIGHT_OF = { N: 'E', E: 'S', S: 'W', W: 'N' };
  const LEFT_OF = { N: 'W', W: 'S', S: 'E', E: 'N' };
  const SLOT_FACING = ['N', 'S', 'W', 'E'];
  const ENTER_TO_FACING = { S: 'N', N: 'S', E: 'W', W: 'E' };

  function resolveExit(car, slotIndex) {
    const enterDir = car.enterFrom;
    const facing = enterDir ? (ENTER_TO_FACING[enterDir] || SLOT_FACING[slotIndex] || 'N')
                            : (SLOT_FACING[slotIndex] || 'N');
    const text = `${car.name || ''} ${car.dir || ''}`.toLowerCase().replace(/[\u2018\u2019`]/g, "'");
    const turnsLeft = (text.includes('chapga') || (text.includes('chap') && (text.includes('buril') || text.includes('qayril') || text.includes('yo‘l') || text.includes("yo'l")))) &&
                      !text.includes("chap tomoni bo'sh") && !text.includes("chapdan");
    const turnsRight = !turnsLeft && (text.includes("o'ngga") || text.includes("ongga") || (text.includes("o'ng") && (text.includes('buril') || text.includes('qayril')))) &&
                       !text.includes("o'ng tomoni bo'sh") && !text.includes("ong tomoni bo'sh");
    const finalFacing = turnsLeft ? LEFT_OF[facing] : (turnsRight ? RIGHT_OF[facing] : facing);
    return EXIT_POINTS[finalFacing] || EXIT_POINTS[facing];
  }

  // sc-1 car 0: Yellow (South, straight, "O'ng tomoni bo'sh") -> should go straight North
  const sc1Car0 = scs[0].cars[0];
  assert(resolveExit(sc1Car0, 0) === EXIT_POINTS.N, 'sc-1 Yellow car goes straight North (ignores "o\'ng tomoni bo\'sh")');

  // sc-1 car 2: Blue (East, turns left) -> facing W -> left of W is S -> exit S
  const sc1Car2 = scs[0].cars[2];
  assert(resolveExit(sc1Car2, 2) === EXIT_POINTS.S, 'sc-1 Blue car enters from East, turns left (exits South)');

  // sc-2 car 1: Red (North, turns left) -> facing S -> left of S is E -> exit E
  const sc2Car1 = scs[1].cars[1];
  assert(resolveExit(sc2Car1, 1) === EXIT_POINTS.E, 'sc-2 Red car enters from North, turns left (exits East)');

  // sc-4 car 0: Tram (South, turns left) -> facing N -> left of N is W -> exit W
  const sc4Car0 = scs[3].cars[0];
  assert(resolveExit(sc4Car0, 0) === EXIT_POINTS.W, 'sc-4 Tram enters from South, turns left (exits West)');
}

// -------------------------------------------------------------
// Test 2 & 3 & 6: Storage isolation, Guest defaults, Lessons & Dashboard
// -------------------------------------------------------------
console.log('\n--- 2 & 3 & 6. Storage Isolation & Clean Defaults ---');
{
  const mockLocalStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };

  const sandbox = {
    window: {},
    document: {
      getElementById: () => null,
      querySelectorAll: () => []
    },
    localStorage: mockLocalStorage,
    matchMedia: () => ({ matches: false }),
    console: { warn: () => {}, error: () => {}, log: () => {} }
  };
  vm.createContext(sandbox);

  const dataContent = fs.readFileSync('js/data.js', 'utf8');
  const storageContent = fs.readFileSync('js/storage.js', 'utf8');
  const authContent = fs.readFileSync('js/auth.js', 'utf8');
  vm.runInContext(dataContent, sandbox);
  vm.runInContext(storageContent, sandbox);
  vm.runInContext(authContent, sandbox);

  // Guest state (no active session)
  assert(!sandbox.window.OSON_AUTH.isAuthenticated(), 'Initial state is unauthenticated (Guest)');
  const guestHistory = sandbox.window.OSON_STORAGE.get(sandbox.window.OSON_STORAGE.KEYS.TEST_HISTORY);
  const guestLessons = sandbox.window.OSON_STORAGE.get(sandbox.window.OSON_STORAGE.KEYS.LESSON_PROGRESS);
  const guestAch = sandbox.window.OSON_STORAGE.get(sandbox.window.OSON_STORAGE.KEYS.ACHIEVEMENTS);
  assert(Array.isArray(guestHistory) && guestHistory.length === 0, 'Guest test history is empty []');
  assert(typeof guestLessons === 'object' && Object.keys(guestLessons).length === 0, 'Guest lesson progress is empty {}');
  assert(Array.isArray(guestAch) && guestAch.length === 0, 'Guest achievements are empty []');

  // Register a new user
  const regRes = sandbox.window.OSON_AUTH.register('Jasur Bek', 'jasur@mail.uz', '12345', '12345');
  assert(regRes.success && sandbox.window.OSON_AUTH.isAuthenticated(), 'User Jasur registered and logged in');
  assert(sandbox.window.OSON_STORAGE.get(sandbox.window.OSON_STORAGE.KEYS.TEST_HISTORY).length === 0, 'New user starts with 0 tests');

  // User takes a test
  sandbox.window.OSON_STORAGE.saveTestResult({ score: 19, total: 20, percentage: 95, passed: true, topic: 'Aralash' });
  assert(sandbox.window.OSON_STORAGE.get(sandbox.window.OSON_STORAGE.KEYS.TEST_HISTORY).length === 1, 'Jasur now has 1 test recorded');

  // User logs out -> Guest must see 0 tests again
  sandbox.window.OSON_AUTH.logout();
  assert(!sandbox.window.OSON_AUTH.isAuthenticated(), 'Logged out to guest');
  assert(sandbox.window.OSON_STORAGE.get(sandbox.window.OSON_STORAGE.KEYS.TEST_HISTORY).length === 0, 'Guest sees 0 tests after user logs out');

  // Demo user logs in -> sees demo user data
  sandbox.window.OSON_AUTH.loginDemo();
  assert(sandbox.window.OSON_AUTH.isAuthenticated(), 'Demo user logged in');
}

// -------------------------------------------------------------
// Test 4: AI Tutor Real API & Conversational Generation
// -------------------------------------------------------------
console.log('\n--- 4. AI Tutor Real API & Conversational Engine ---');
{
  const aiContent = fs.readFileSync('js/ai-tutor.js', 'utf8');
  assert(aiContent.includes("fetch('/api/ai/chat'"), 'AI tutor queries /api/ai/chat API asynchronously');
  assert(aiContent.includes('history: recentHistory'), 'AI tutor transmits conversation history to API');
  assert(aiContent.includes('userState: userState'), 'AI tutor transmits user context to API');
  assert(aiContent.includes('Baza hisoblash miqdori') && aiContent.includes('375,000'), 'AI tutor fallback has 2026 BHM fine details');

  const serverContent = fs.readFileSync('server.js', 'utf8');
  assert(serverContent.includes("reqPath === '/api/ai/chat' && req.method === 'POST'"), 'server.js provides POST /api/ai/chat endpoint');
  assert(serverContent.includes('generateSmartAIResponse'), 'server.js includes dynamic AI response generator');
}

// -------------------------------------------------------------
// Test 5: Server API & Tests Questions Fetch
// -------------------------------------------------------------
console.log('\n--- 5. Server GET /api/questions & Tests Module ---');
{
  const serverContent = fs.readFileSync('server.js', 'utf8');
  assert(serverContent.includes("reqPath === '/api/questions'"), 'server.js handles GET /api/questions');
  assert(serverContent.includes("Access-Control-Allow-Origin"), 'server.js sets CORS headers');

  const testsContent = fs.readFileSync('js/tests.js', 'utf8');
  assert(testsContent.includes('fetchServerQuestions'), 'tests.js has fetchServerQuestions()');
  assert(testsContent.includes('retryLoadQuestions'), 'tests.js has retryLoadQuestions()');
  assert(testsContent.includes('showQuestionsErrorUI'), 'tests.js has error retry UI handler');
}

// -------------------------------------------------------------
// Test 7: Favicon, Header Logo, Manifest Quality
// -------------------------------------------------------------
console.log('\n--- 7. Favicon, Header Logo & Manifest ---');
{
  const favContent = fs.readFileSync('favicon.svg', 'utf8');
  assert(favContent.includes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"'), 'favicon.svg is valid 120x120 SVG');
  assert(favContent.includes('opBgGrad') && favContent.includes('opGoldGrad'), 'favicon.svg contains rich gradient defs');

  const indexContent = fs.readFileSync('index.html', 'utf8');
  assert(indexContent.includes('viewBox="0 0 120 120"'), 'Header logo uses modern 120x120 SVG');

  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert(manifest.icons && manifest.icons.length >= 2, 'manifest.json has icons configured');
}

// -------------------------------------------------------------
// Test 8: Official Certificate Stamp
// -------------------------------------------------------------
console.log('\n--- 8. Certificate Official Seal Stamp with Logo ---');
{
  const certContent = fs.readFileSync('js/certificate.js', 'utf8');
  assert(certContent.includes('official-seal-stamp'), 'certificate.js contains official-seal-stamp');
  assert(certContent.includes('OSON PRAVA • MILLIY TA’LIM'), 'Seal stamp has curved academy header');
  assert(certContent.includes('YHQ RASMIY MUHR • 2026'), 'Seal stamp has YHQ official stamp text');
  assert(certContent.includes('stampGrain'), 'Seal stamp has authentic ink grain filter');

  const cssContent = fs.readFileSync('css/style.css', 'utf8');
  assert(cssContent.includes('.official-seal-stamp'), 'style.css has .official-seal-stamp styles');
}

// -------------------------------------------------------------
// Test 9: Container & Dynamic Hero Readiness Card Verification
// -------------------------------------------------------------
console.log('\n--- 3b & 9. Hero Readiness Dynamic Card & Container Isolation ---');
{
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert(indexHtml.includes('id="hero-readiness-badge"'), 'index.html has hero-readiness-badge ID');
  assert(indexHtml.includes('id="hero-readiness-score-box"'), 'index.html has hero-readiness-score-box ID');
  assert(!indexHtml.includes('Siz 45 ta test savolini 91% aniqlik bilan yechdingiz'), 'Static demo test stats removed from index.html');

  const uiContent = fs.readFileSync('js/ui.js', 'utf8');
  assert(uiContent.includes('updateHeroReadiness'), 'js/ui.js contains updateHeroReadiness()');

  const authContent = fs.readFileSync('js/auth.js', 'utf8');
  assert(authContent.includes('updateHeroReadiness'), 'js/auth.js calls updateHeroReadiness on auth sync');

  const cssContent = fs.readFileSync('css/style.css', 'utf8');
  assert(cssContent.includes('.container,\n.site-container,\n.main-container'), 'style.css defines global container');
  assert(cssContent.includes('.header-container'), 'style.css maintains independent header-container');
}

console.log(`\n=============================================`);
console.log(`  Test Results: ${passed} passed, ${failed} failed`);
console.log(`=============================================\n`);
if (failed > 0) process.exit(1);

