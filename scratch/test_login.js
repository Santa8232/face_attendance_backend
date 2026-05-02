
const http = require('http');

const data = JSON.stringify({
  username: 'prof_smith',
  password: 'password123', 
  device_id: 'test-device-123',
  device_name: 'Antigravity-Tester',
  device_model: 'AI-Model',
  os_version: 'v1',
  app_version: '1.0.0'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🚀 Sending login request for prof_smith...');

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(body);
      console.log('Response:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Raw body:', body);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.write(data);
req.end();
