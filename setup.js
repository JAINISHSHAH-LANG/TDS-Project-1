require('dotenv').config();
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 LLM Code Deployment - Setup');
console.log('=============================\n');

const questions = [
  {
    name: 'GITHUB_TOKEN',
    message: 'Enter your GitHub Personal Access Token (with repo scope):',
    validate: input => input.length > 0 || 'GitHub token is required'
  },
  {
    name: 'GITHUB_USERNAME',
    message: 'Enter your GitHub username:',
    validate: input => input.length > 0 || 'GitHub username is required'
  },
  {
    name: 'OPENAI_API_KEY',
    message: 'Enter your OpenAI API key:',
    validate: input => input.length > 0 || 'OpenAI API key is required'
  },
  {
    name: 'SECRET_KEY',
    message: 'Enter a secret key for API authentication:',
    default: 'my-secret-deployment-key-123'
  }
];

const answers = {};

function askQuestion(index) {
  if (index >= questions.length) {
    // All questions answered, write to .env file
    let envContent = '# LLM Code Deployment Environment Variables\n';
    
    questions.forEach(q => {
      envContent += `${q.name}=${answers[q.name]}\n`;
    });

    fs.writeFileSync('.env', envContent);
    console.log('\n✅ Environment variables saved to .env file');
    console.log('\n🔧 Next steps:');
    console.log('1. Run: npm install');
    console.log('2. Run: npm run dev');
    console.log('3. Test with: npm test');
    console.log('\n🚀 Happy coding!');
    
    rl.close();
    return;
  }

  const q = questions[index];
  
  rl.question(`${q.message} `, (answer) => {
    if (q.validate && typeof q.validate === 'function') {
      const validation = q.validate(answer || q.default);
      if (validation !== true) {
        console.log(`❌ ${validation}`);
        return askQuestion(index); // Ask same question again
      }
    }
    
    answers[q.name] = answer || q.default;
    askQuestion(index + 1);
  });
}

// Start asking questions
askQuestion(0);
