/**
 * Comprehensive Automated Verification for OSON PRAVA Demo Account System
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.join(__dirname, '..');

// 1. Mock Browser Environment
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: (key) => store[key] !== undefined ? store[key] : null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => ({ ...store })
  };
})();

const domElements = {};
function getOrCreateElement(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id,
      innerHTML: '',
      textContent: '',
      className: '',
      style: {},
      children: [],
      classList: {
        _classes: new Set(),
        add: function(...classes) { classes.forEach(c => this._classes.add(c)); },
        remove: function(...classes) { classes.forEach(c => this._classes.delete(c)); },
        contains: function(c) { return this._classes.has(c); }
      },
      querySelectorAll: (sel) => [],
      querySelector: (sel) => null,
      setAttribute: () => {},
      disabled: false
    };
  }
  return domElements[id];
}

const mockWindow = {
  localStorage: localStorageMock,
  location: { hash: '' },
  matchMedia: () => ({ matches: false }),
  document: {
    getElementById: (id) => getOrCreateElement(id),
    createElement: (tag) => {
      const el = getOrCreateElement('el_' + Math.random());
      el.tagName = tag.toUpperCase();
      return el;
    },
    body: { appendChild: () => {}, removeChild: () => {} },
    querySelectorAll: (sel) => {
      if (sel === '.user-avatar-text') return [getOrCreateElement('av1'), getOrCreateElement('av2')];
      if (sel === '.user-name-text') return [getOrCreateElement('n1'), getOrCreateElement('n2')];
      if (sel === '.user-email-text') return [getOrCreateElement('e1'), getOrCreateElement('e2')];
      if (sel === '.user-plan-badge') return [getOrCreateElement('p1'), getOrCreateElement('p2')];
      if (sel === '.user-streak-badge') return [getOrCreateElement('s1'), getOrCreateElement('s2')];
      return [];
    },
    addEventListener: () => {},
    fonts: { ready: Promise.resolve() }
  },
  navigator: { clipboard: { writeText: async () => true } }
};

mockWindow.window = mockWindow;

const context = vm.createContext({
  window: mockWindow,
  document: mockWindow.document,
  localStorage: localStorageMock,
  navigator: mockWindow.navigator,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Promise: Promise
});

// UI Mock
const uiMock = `
window.OSON_UI = {
  openModal: (id) => { window._lastOpenedModal = id; },
  closeModal: (id) => { window._lastClosedModal = id; },
  showToast: (msg, type) => { window._lastToast = { msg, type }; },
  updateHeroReadiness: () => {}
};
`;
vm.runInContext(uiMock, context);

// Load Storage, Auth, Certificate, Profile, UI (partial)
const storageCode = fs.readFileSync(path.join(baseDir, 'js', 'storage.js'), 'utf8');
vm.runInContext(storageCode, context);

const authCode = fs.readFileSync(path.join(baseDir, 'js', 'auth.js'), 'utf8');
vm.runInContext(authCode, context);

const certCode = fs.readFileSync(path.join(baseDir, 'js', 'certificate.js'), 'utf8');
vm.runInContext(certCode, context);

const profileCode = fs.readFileSync(path.join(baseDir, 'js', 'profile.js'), 'utf8');
vm.runInContext(profileCode, context);

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exit(1);
  } else {
    console.log('✅ PASS:', message);
  }
}

console.log('--- STARTING DEMO ACCOUNT VERIFICATION TESTS ---');

// 1. Initial Guest State
context.window.OSON_STORAGE.clearAllData();
assert(!context.window.OSON_AUTH.isAuthenticated(), "Initial state is unauthenticated Guest");

// 2. Demo User Login
const demoLoginRes = context.window.OSON_AUTH.loginDemo();
assert(demoLoginRes.success, "Demo login succeeds");
const demoUser = context.window.OSON_AUTH.getUser();
assert(demoUser !== null, "Demo user session is active");

// Verify Demo User object structure
assert(demoUser.id === 'demo-user', `Demo user id is 'demo-user': ${demoUser.id}`);
assert(demoUser.name === 'Demo User', `Demo user name is 'Demo User': ${demoUser.name}`);
assert(demoUser.email === 'demo@osonprava.uz', `Demo user email is 'demo@osonprava.uz': ${demoUser.email}`);
assert(demoUser.username === 'demo', `Demo user username is 'demo': ${demoUser.username}`);
assert(demoUser.avatar === 'DU', `Demo user avatar is 'DU': ${demoUser.avatar}`);
assert(demoUser.accountType === 'demo', `Demo user accountType is 'demo': ${demoUser.accountType}`);
assert(demoUser.status === 'Demo', `Demo user status is 'Demo': ${demoUser.status}`);
assert(demoUser.isDemo === true, `Demo user isDemo is true`);

// 3. Header & Dropdown sync
const av1 = getOrCreateElement('av1');
const n1 = getOrCreateElement('n1');
const e1 = getOrCreateElement('e1');
const p1 = getOrCreateElement('p1');
const headerBadge = getOrCreateElement('header-user-status-badge');

assert(av1.textContent === 'DU', `Header avatar displays 'DU': ${av1.textContent}`);
assert(n1.textContent === 'Demo User', `Header user name displays 'Demo User': ${n1.textContent}`);
assert(e1.textContent === 'demo@osonprava.uz', `Header user email displays 'demo@osonprava.uz': ${e1.textContent}`);
assert(headerBadge.textContent === 'DEMO', `Header has DEMO badge: ${headerBadge.textContent}`);
assert(!headerBadge.classList.contains('hidden'), "Header DEMO badge is visible");
assert(p1.innerHTML.includes('DEMO') || p1.textContent.includes('DEMO'), "Dropdown plan badge has DEMO");

// 4. Dashboard Greeting sync
context.window.OSON_PROFILE.renderDashboard();
const greetingEl = getOrCreateElement('dash-greeting-name');
assert(greetingEl.textContent === 'Demo User', `Dashboard greeting displays 'Demo User': ${greetingEl.textContent}`);

// 5. Profile Page sync
context.window.OSON_PROFILE.renderProfile();
const pName = getOrCreateElement('profile-name');
const pEmail = getOrCreateElement('profile-email');
const pAvatar = getOrCreateElement('profile-avatar');
const pCreated = getOrCreateElement('profile-created');
const pDemoBadge = getOrCreateElement('profile-demo-badge');

assert(pName.textContent === 'Demo User', `Profile page displays 'Demo User': ${pName.textContent}`);
assert(pEmail.textContent === 'demo@osonprava.uz', `Profile page displays 'demo@osonprava.uz': ${pEmail.textContent}`);
assert(pAvatar.textContent === 'DU', `Profile avatar displays 'DU': ${pAvatar.textContent}`);
assert(pCreated.textContent.includes('Demo account'), `Profile created displays 'Demo account': ${pCreated.textContent}`);
assert(!pDemoBadge.classList.contains('hidden'), "Profile DEMO ACCOUNT badge is visible");
assert(pDemoBadge.innerHTML.includes('DEMO ACCOUNT'), "Profile demo badge contains 'DEMO ACCOUNT'");

// 6. Certificate modal for Demo User
context.window.OSON_CERTIFICATE.openCertificate();
const certContent = getOrCreateElement('certificate-content').innerHTML;
assert(certContent.includes('Demo User'), "Certificate displays 'Demo User'");
assert(certContent.includes('DEMO REJIM • NAMUNA SERTIFIKAT'), "Certificate clearly displays 'DEMO REJIM • NAMUNA SERTIFIKAT' badge");
assert(certContent.includes('OP-2026-DEMO'), "Certificate ID displays OP-2026-DEMO");
assert(certContent.includes('DEMO</span>'), "Certificate number has DEMO indicator");
assert(!certContent.includes('Abror'), "Certificate does NOT contain 'Abror'");

// 7. Verify NO "Abror" in rendered UI
assert(!certContent.includes('Abror'), "No Abror in Certificate");
assert(!n1.textContent.includes('Abror'), "No Abror in Header");
assert(!greetingEl.textContent.includes('Abror'), "No Abror in Dashboard");
assert(!pName.textContent.includes('Abror'), "No Abror in Profile");

// 8. Logout Demo User -> Back to Guest
context.window.OSON_AUTH.logout();
assert(!context.window.OSON_AUTH.isAuthenticated(), "Demo user logged out cleanly");

// 9. Real User Registration & Isolation Test
const realReg = context.window.OSON_AUTH.register('Sardor Rahimov', 'sardor@example.com', 'pass123', 'pass123');
assert(realReg.success, "Real user Sardor registered");
const realUser = context.window.OSON_AUTH.getUser();
assert(realUser.name === 'Sardor Rahimov', `Real user name is 'Sardor Rahimov': ${realUser.name}`);
assert(realUser.email === 'sardor@example.com', `Real user email is 'sardor@example.com': ${realUser.email}`);
assert(realUser.avatar === 'SR', `Real user avatar is 'SR': ${realUser.avatar}`);
assert(!realUser.isDemo, "Real user isDemo is false / undefined");

// Real user syncAuthUI
context.window.OSON_AUTH.syncAuthUI();
assert(av1.textContent === 'SR', `Header avatar for real user is 'SR': ${av1.textContent}`);
assert(n1.textContent === 'Sardor Rahimov', `Header name for real user is 'Sardor Rahimov': ${n1.textContent}`);
assert(headerBadge.classList.contains('hidden'), "Header DEMO badge is HIDDEN for real user");

// Real user Profile sync
context.window.OSON_PROFILE.renderProfile();
assert(pName.textContent === 'Sardor Rahimov', "Profile displays real user name 'Sardor Rahimov'");
assert(pDemoBadge.classList.contains('hidden'), "Profile DEMO badge is HIDDEN for real user");

// Real user Certificate check (Must NOT show demo certificate or fake passed certificate!)
context.window.OSON_CERTIFICATE.openCertificate();
const realCertContent = getOrCreateElement('certificate-content').innerHTML;
assert(realCertContent.includes("Sizda hali rasmiy sertifikat mavjud emas"), "Real user without exam sees empty state");
assert(!realCertContent.includes("Demo User"), "Real user does NOT see Demo User");
assert(!realCertContent.includes("DEMO REJIM"), "Real user does NOT see DEMO REJIM badge");

console.log('--- ALL DEMO ACCOUNT VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
