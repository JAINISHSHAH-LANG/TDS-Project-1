require('dotenv').config();
const fetch = require('node-fetch');

const SECRET_KEY = process.env.SECRET_KEY || 'my-secret-deployment-key-123';
const API_URL = process.env.API_URL || 'http://localhost:3000/api/deploy';

async function testDeployment() {
  // Test data for Round 1
  const round1Data = {
    secret: SECRET_KEY,
    task: "sum-of-sales-abc12",
    round: 1,
    nonce: "test-nonce-" + Date.now(),
    brief: "Create a simple web page that displays 'Hello World' with a blue background. Add a button that shows an alert when clicked.",
    checks: [
      "Page displays 'Hello World'",
      "Background is blue",
      "Button triggers alert on click"
    ],
    evaluation_url: "https://webhook.site/8bbc90ad-a189-4781-a1b5-9a3380c1eda5",
    attachments: []
  };

  try {
    console.log('Sending test request to:', API_URL);
    console.log('Test data:', JSON.stringify(round1Data, null, 2));
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(round1Data)
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Test request successful!');
      console.log('Deployed URL:', data.url);
      console.log('GitHub Repo:', data.repo);
    } else {
      console.error('❌ Test request failed:', data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Error sending test request:', error.message);
  }
}

testDeployment();
