const http = require('http');

function testChat(query, history = []) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, history, userState: { isAuthenticated: true, name: 'Jasur', testsCount: 5 } });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('Testing AI chat API...');
  
  // Test 1: Simple question
  const r1 = await testChat('chorrahada kim birinchi o\'tadi?');
  console.log('\n--- Test 1 (Simple query):', r1.query);
  console.log('Success:', r1.success);
  console.log('Action:', r1.actionUrl, '|', r1.actionLabel);
  console.log('Text snippet:', r1.text.substring(0, 150) + '...');
  
  // Test 2: Complex situational question
  const r2 = await testChat('ikkita mashina bir vaqtda chorrahaga yetib kelsa, biri asosiy yo\'lda, ikkinchisi svetofor buzilgan holda ikkinchi darajali yo\'ldan kelsa, kim yo\'l beradi?');
  console.log('\n--- Test 2 (Complex situational):', r2.query);
  console.log('Success:', r2.success);
  console.log('Action:', r2.actionUrl, '|', r2.actionLabel);
  console.log('Text snippet:', r2.text.substring(0, 200) + '...');

  // Test 3: Fines question
  const r3 = await testChat('qizil chiroqqa 2 marta o\'tsam qancha jarima va necha ball bo\'ladi?');
  console.log('\n--- Test 3 (Fines calculation):', r3.query);
  console.log('Success:', r3.success);
  console.log('Action:', r3.actionUrl, '|', r3.actionLabel);
  console.log('Text snippet:', r3.text.substring(0, 150) + '...');

  if (r1.success && r2.success && r3.success && r1.text !== r2.text) {
    console.log('\n✅ ALL AI API TESTS PASSED! Different queries produce distinct custom generated answers.');
  } else {
    console.error('\n❌ AI API TEST FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
