require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 LLM Code Deployment - Setup Verification');
console.log('==========================================\n');

// Check environment variables
console.log('📋 Environment Variables:');
const requiredVars = ['GITHUB_TOKEN', 'GITHUB_USERNAME', 'OPENAI_API_KEY', 'SECRET_KEY'];
let allEnvVarsPresent = true;

requiredVars.forEach(varName => {
  const isPresent = process.env[varName] ? '✅' : '❌';
  const value = process.env[varName] 
    ? process.env[varName].substring(0, 10) + '...' 
    : 'Not set';
  
  console.log(`${isPresent} ${varName}: ${value}`);
  if (!process.env[varName]) allEnvVarsPresent = false;
});

// Check required files
console.log('\n📦 Dependencies:');
const checkDependency = (name) => {
  try {
    require.resolve(name);
    console.log(`✅ ${name}: Installed`);
    return true;
  } catch {
    console.log(`❌ ${name}: Not installed`);
    return false;
  }
};

['express', 'openai', '@octokit/rest', 'dotenv', 'cors'].forEach(checkDependency);

// Check project files
console.log('\n📁 Project Files:');
const requiredFiles = [
  'index.js',
  'test-request.js',
  'package.json',
  '.gitignore',
  'vercel.json',
  'README.md'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '❌'} ${file}: ${exists ? 'Exists' : 'Missing'}`);
});

// Test server health
console.log('\n🏥 Server Health Check:');
(async () => {
  try {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();
    console.log(`✅ Server: ${data.status === 'healthy' ? 'Running and healthy' : 'Running but unhealthy'}`);
    console.log('   Status:', data.status);
    console.log('   Time:', new Date().toISOString());
  } catch (error) {
    console.log('❌ Server: Not running or not responding');
    console.log('   Error:', error.message);
  }

  console.log('\n📊 Setup Summary:');
  if (allEnvVarsPresent) {
    console.log('✅ All required environment variables are set');
  } else {
    console.log('❌ Missing environment variables');
    console.log('   Run: npm run setup');
  }

  console.log('\n🚀 Next Steps:');
  if (!allEnvVarsPresent) {
    console.log('1. Configure environment variables');
  }
  console.log('2. Start server: npm run dev');
  console.log('3. Test locally: npm test');

  console.log('\n📚 See SETUP_CHECKLIST.md for detailed instructions');
})();
