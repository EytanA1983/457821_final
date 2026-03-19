/**
 * Check if Vite proxy is working correctly
 * This script tests if requests to /api are being proxied to http://localhost:8000
 * 
 * Run this in the browser console on http://localhost:5179
 */

console.log('='.repeat(70));
console.log('  🔍 Vite Proxy Check');
console.log('='.repeat(70));
console.log();

// Test 1: Check if we're on the correct port
const currentPort = window.location.port;
const expectedPort = '5179';
console.log(`📍 Current port: ${currentPort}`);
if (currentPort === expectedPort) {
  console.log(`✅ Port is correct (${expectedPort})`);
} else {
  console.log(`⚠️  Port is ${currentPort}, expected ${expectedPort}`);
}
console.log();

// Test 2: Check baseURL configuration
console.log('🔍 Checking API baseURL configuration...');
const apiBaseURL = import.meta.env.VITE_API_URL || '';
console.log(`   VITE_API_URL: ${apiBaseURL || '(not set - using relative URLs)'}`);
console.log(`   import.meta.env.DEV: ${import.meta.env.DEV}`);
console.log(`   Expected behavior: ${import.meta.env.DEV ? 'Use Vite proxy (relative URLs)' : 'Use direct URL'}`);
console.log();

// Test 3: Test proxy with fetch
console.log('🔍 Testing proxy with fetch...');
console.log('   Request: GET /api/health');
console.log('   Expected: Proxied to http://localhost:8000/api/health');
console.log();

fetch('/api/health')
  .then(response => {
    console.log(`✅ Proxy working! Status: ${response.status}`);
    return response.json();
  })
  .then(data => {
    console.log('   Response:', data);
    console.log();
    console.log('='.repeat(70));
    console.log('  ✅ Vite Proxy is working correctly!');
    console.log('='.repeat(70));
  })
  .catch(error => {
    console.error('❌ Proxy test failed:', error);
    console.error();
    console.error('Possible causes:');
    console.error('  1. Backend server is not running on http://localhost:8000');
    console.error('  2. Vite proxy is not configured correctly');
    console.error('  3. Network connectivity issue');
    console.error();
    console.error('💡 Check:');
    console.error('  - Is backend running? curl http://localhost:8000/health');
    console.error('  - Check vite.config.ts proxy configuration');
    console.error('  - Check browser Network tab for request details');
    console.log();
    console.log('='.repeat(70));
    console.log('  ❌ Vite Proxy test failed');
    console.log('='.repeat(70));
  });
