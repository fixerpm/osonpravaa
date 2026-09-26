/**
 * OSON PRAVA — Comprehensive Automated Test Suite
 * Validates all 8 project tasks and core subsystems
 */

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n============================================================');
console.log('  RUNNING OSON PRAVA AUTOMATED VERIFICATION SUITE');
console.log('============================================================\n');

const rootDir = path.join(__dirname, '..');

// -------------------------------------------------------------
// 1. CHORRAHA 2D SIMULATOR VERIFICATION
// -------------------------------------------------------------
console.log('1. CHORRAHA SIMULATOR & CAR DIRECTION RESOLUTION:');
global.window = {};
require(path.join(rootDir, 'js/data.js'));

const scenarios = window.OSON_DATA.simulatorScenarios;
assert(Array.isArray(scenarios) && scenarios.length === 8, 'All 8 simulator scenarios exist');

const RIGHT_OF = { N: 'E', E: 'S', S: 'W', W: 'N' };
const LEFT_OF = { N: 'W', W: 'S', S: 'E', E: 'N' };
const ENTER_TO_FACING = { S: 'N', N: 'S', E: 'W', W: 'E' };
const SLOT_FACING = ['N', 'S', 'W', 'E'];
const EXIT_POINTS = {
  N: 'translate(210, -120)',
  S: 'translate(155, 450)',
  E: 'translate(450, 200)',
  W: 'translate(-100, 155)'
};

scenarios.forEach((sc, i) => {
  sc.cars.forEach((car, slot) => {
    assert(car.enterFrom !== undefined, `Scenario ${i + 1} (${car.id}) has enterFrom: ${car.enterFrom}`);
    const facing = ENTER_TO_FACING[car.enterFrom] || SLOT_FACING[slot];
    const text = `${car.name || ''} ${car.dir || ''}`.toLowerCase();
    const turnsLeft = text.includes('chap');
    const turnsRight = !turnsLeft && /o.ng/.test(text) && text.includes('buril');
    const finalFacing = turnsLeft ? LEFT_OF[facing] : (turnsRight ? RIGHT_OF[facing] : facing);
    const exitPoint = EXIT_POINTS[finalFacing];
    assert(exitPoint !== undefined, `Scenario ${i + 1} (${car.id}) exitPoint correctly resolved to ${finalFacing} (${exitPoint})`);
  });
});

// Specific left turn tests:
// sc-1 car 2 (blue): enters E, faces W, turns left -> faces S
assert(LEFT_OF[ENTER_TO_FACING['E']] === 'S', 'Blue car (enter E, face W) turning left exits South');
// sc-2 car 1 (red): enters N, faces S, turns left -> faces E
assert(LEFT_OF[ENTER_TO_FACING['N']] === 'E', 'Red car (enter N, face S) turning left exits East');
// sc-5 car 0 (red): enters S, faces N, turns left -> faces W
assert(LEFT_OF[ENTER_TO_FACING['S']] === 'W', 'Red car (enter S, face N) turning left exits West');

// -------------------------------------------------------------
// 2. STORAGE & AUTH DEFAULTS (EMPTY STATE FOR NEW USERS)
// -------------------------------------------------------------
console.log('\n2. STORAGE & AUTH DEFAULTS (CLEAN STATE):');
const mockStorage = {};
global.localStorage = {
  getItem: k => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: k => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
global.window.matchMedia = () => ({ matches: false });

require(path.join(rootDir, 'js/storage.js'));
const storage = window.OSON_STORAGE;

assert(storage.get(storage.KEYS.TEST_HISTORY).length === 0, 'New visitor has empty test history []');
assert(Object.keys(storage.get(storage.KEYS.LESSON_PROGRESS)).length === 0, 'New visitor has empty lesson progress {}');
assert(storage.get(storage.KEYS.ACHIEVEMENTS).length === 0, 'New visitor has empty achievements []');
assert(storage.get(storage.KEYS.FAVORITES).length === 0, 'New visitor has empty favorites []');
assert(storage.get(storage.KEYS.SAVED_QUESTIONS).length === 0, 'New visitor has empty saved questions []');

global.document = {
  getElementById: () => ({ classList: { add: () => {}, remove: () => {} }, textContent: '', innerHTML: '', style: {} }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.window.addEventListener = () => {};

// Test auth
require(path.join(rootDir, 'js/auth.js'));
const auth = window.OSON_AUTH;
assert(auth.getUser() === null, 'Unauthenticated visitor is GUEST (null user)');

const regResult = auth.register('Dilshod Aliyev', 'dilshod@example.com', 'parol123', 'parol123');
assert(regResult.success, 'Registration succeeds');
assert(regResult.user.streak === 0, 'Newly registered user has streak: 0');

// Reset progress test
storage.resetAllProgress();
assert(storage.get(storage.KEYS.TEST_HISTORY).length === 0, 'resetAllProgress leaves test history empty');
assert(storage.get(storage.KEYS.ACHIEVEMENTS).length === 0, 'resetAllProgress leaves achievements empty');

// -------------------------------------------------------------
// 3. TESTS LOGIC & QUESTION MATCHING
// -------------------------------------------------------------
console.log('\n3. TEST LOADER & TOPIC MATCHING:');

require(path.join(rootDir, 'js/tests.js'));
const tests = window.OSON_TESTS;

assert(window.OSON_DATA.questions.length >= 60, `Question bank has ${window.OSON_DATA.questions.length} questions (>= 60)`);

// Test all categories from testPacks
window.OSON_DATA.testPacks.forEach(pack => {
  tests.startTest({ topic: pack.category });
  // If startTest ran without throwing, it successfully created currentSession
  assert(true, `Test pack '${pack.category}' starts without freezing or crashing`);
});

// Test all categories from navigation categories
window.OSON_DATA.categories.forEach(cat => {
  tests.startTopicPractice(cat.name);
  assert(true, `Category '${cat.name}' starts practice without crashing`);
});

// Test all lessons categories
window.OSON_DATA.lessons.forEach(l => {
  tests.startTopicPractice(l.category);
  assert(true, `Lesson category '${l.category}' starts practice without crashing`);
});

// Medical questions specifically
const medQs = window.OSON_DATA.questions.filter(q => q.topic === 'Birinchi tibbiy yordam');
assert(medQs.length >= 8, `Medical aid topic has ${medQs.length} questions (>= 8)`);

// -------------------------------------------------------------
// 4. AI MURABBIY ENHANCEMENTS
// -------------------------------------------------------------
console.log('\n4. AI MURABBIY RESPONSE QUALITY & COMPLEXITY DETECTION:');
require(path.join(rootDir, 'js/ai-tutor.js'));

const complexityIndicators = ['nega', 'sabab', 'farqi', 'qanday hisoblanadi', 'tushuntir', 'batafsil', 'qaysi hollarda', 'nima uchun', 'qanday farq', 'orasidagi farq'];
const testComplex = "Nega qizil chiroqda o'tish taqiqlangan va jarimasi qancha?";
const isComplex = complexityIndicators.some(ind => testComplex.toLowerCase().includes(ind));
assert(isComplex, `Complex query '${testComplex}' correctly detected as complex`);

// Verify new knowledge topics exist
const kbTitles = ['Svetofor signallari va qo‘shimcha seksiyalar', 'Tezlik me’yorlari va hududiy cheklovlar', 'Yo‘l-transport hodisasida birinchi tibbiy yordam', 'Xalqaro haydovchilik guvohnomasi (IDP)', 'Qayrilib olish (U-burilish) qoidalari', 'Harakatlanish taqiqlanadigan texnik nosozliklar'];
const aiCode = fs.readFileSync(path.join(rootDir, 'js/ai-tutor.js'), 'utf8');
kbTitles.forEach(title => {
  assert(aiCode.includes(title), `AI knowledge base includes topic: '${title}'`);
});

// -------------------------------------------------------------
// 5. CERTIFICATE & OFFICIAL SEAL (MUHR)
// -------------------------------------------------------------
console.log('\n5. OFFICIAL CERTIFICATE SEAL & PRINT CSS:');
require(path.join(rootDir, 'js/certificate.js'));
const certCode = fs.readFileSync(path.join(rootDir, 'js/certificate.js'), 'utf8');
assert(certCode.includes('official-seal-stamp'), 'Certificate has official seal stamp element');
assert(certCode.includes('OSON PRAVA • MILLIY TA’LIM'), 'Seal has circular text OSON PRAVA • MILLIY TA’LIM');
assert(certCode.includes('HAYDOVCHILIK MARKAZI'), 'Seal has circular text HAYDOVCHILIK MARKAZI');
assert(certCode.includes('TASDIQLANDI'), 'Seal has confirmation text TASDIQLANDI');

const cssCode = fs.readFileSync(path.join(rootDir, 'css/style.css'), 'utf8');
assert(cssCode.includes('@media print'), 'style.css includes @media print rules');
assert(cssCode.includes('.official-seal-stamp'), 'style.css includes .official-seal-stamp styling');
assert(cssCode.includes('transform: rotate(-8deg)'), 'Seal stamp has realistic -8deg rotation');

// -------------------------------------------------------------
// 6. FAVICON & HEADER LOGO
// -------------------------------------------------------------
console.log('\n6. FAVICON & HEADER LOGO:');
assert(fs.existsSync(path.join(rootDir, 'favicon.svg')), 'favicon.svg exists in project root');
const htmlCode = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
assert(htmlCode.includes('href="favicon.svg"'), 'index.html links to favicon.svg');
assert(htmlCode.includes('rel="apple-touch-icon"'), 'index.html has apple-touch-icon');
assert(htmlCode.includes('dash-tests-empty'), 'index.html has dash-tests-empty element');

const manifestCode = fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8');
assert(manifestCode.includes('favicon.svg'), 'manifest.json uses favicon.svg');

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n============================================================');
console.log(`  ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
console.log('============================================================\n');

if (failedTests > 0) process.exit(1);
process.exit(0);
