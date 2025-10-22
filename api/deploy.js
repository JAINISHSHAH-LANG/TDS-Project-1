// api/deploy.js
export const config = {
  maxDuration: 300, // 5 minutes for Pro plan, 10s for free
};

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, secret, task, round, nonce, brief, checks, evaluation_url, attachments } = req.body;

    // CRITICAL: Verify secret first
    if (secret !== 'my-secret-deployment-key-123') {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    // Validate required fields
    if (!email || !task || !round || !nonce || !brief || !evaluation_url) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Return 200 IMMEDIATELY to avoid timeout
    res.status(200).json({ 
      status: 'accepted',
      message: 'Request received and processing',
      task,
      round
    });

    // Process asynchronously (continues after response sent)
    setImmediate(async () => {
      try {
        await processDeployment({ email, task, round, nonce, brief, checks, evaluation_url, attachments });
      } catch (error) {
        console.error('Deployment processing error:', error);
      }
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function processDeployment(data) {
  const { email, task, round, nonce, brief, checks, evaluation_url, attachments } = data;
  
  try {
    console.log(`Starting deployment for ${email}, task: ${task}, round: ${round}`);

    // Step 1: Generate app code using LLM
    const appCode = await generateAppWithLLM(brief, attachments, checks);

    // Step 2: Create GitHub repo
    const repoName = `${task}-round${round}`.replace(/[^a-zA-Z0-9-]/g, '-');
    const { repoUrl, commitSha, pagesUrl } = await createAndDeployToGitHub(repoName, appCode, brief);

    // Step 3: Wait a bit for Pages to deploy
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

    // Step 4: Notify evaluation API with retries
    await notifyEvaluationAPI(evaluation_url, {
      email,
      task,
      round,
      nonce,
      repo_url: repoUrl,
      commit_sha: commitSha,
      pages_url: pagesUrl
    });

    console.log(`Successfully deployed ${task} for ${email}`);

  } catch (error) {
    console.error('Deployment error:', error);
    throw error;
  }
}

async function generateAppWithLLM(brief, attachments, checks) {
  // Use Claude/OpenAI API to generate app code
  const prompt = `Generate a complete, single-file HTML application based on this brief:

${brief}

Requirements:
${checks.map(c => `- ${c}`).join('\n')}

${attachments && attachments.length > 0 ? `Attachments provided:
${attachments.map(a => `- ${a.name}`).join('\n')}` : ''}

Generate a single HTML file with embedded CSS and JavaScript. Include:
- All necessary CDN links for libraries
- Clean, working code
- Comments explaining key sections
- Responsive design with Bootstrap if mentioned

Return ONLY the HTML code, no explanations.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  const data = await response.json();
  const htmlCode = data.content[0].text;

  // Generate README
  const readme = generateReadme(brief, checks);

  return {
    'index.html': htmlCode,
    'README.md': readme,
    'LICENSE': getMITLicense()
  };
}

async function createAndDeployToGitHub(repoName, files, brief) {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USERNAME;

  if (!token || !username) {
    throw new Error('GitHub credentials not configured');
  }

  // 1. Create repository
  const createRepoResponse = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DeploymentBot'
    },
    body: JSON.stringify({
      name: repoName,
      description: brief.substring(0, 100),
      private: false,
      auto_init: false
    })
  });

  if (!createRepoResponse.ok) {
    const error = await createRepoResponse.json();
    throw new Error(`Failed to create repo: ${error.message}`);
  }

  const repo = await createRepoResponse.json();

  // 2. Create files using GitHub API
  for (const [filename, content] of Object.entries(files)) {
    await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DeploymentBot'
      },
      body: JSON.stringify({
        message: `Add ${filename}`,
        content: Buffer.from(content).toString('base64')
      })
    });
  }

  // 3. Enable GitHub Pages
  await fetch(`https://api.github.com/repos/${username}/${repoName}/pages`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DeploymentBot',
      'Accept': 'application/vnd.github.switcheroo-preview+json'
    },
    body: JSON.stringify({
      source: {
        branch: 'main',
        path: '/'
      }
    })
  });

  // Get latest commit SHA
  const commitsResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}/commits/main`, {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'DeploymentBot'
    }
  });
  const commitData = await commitsResponse.json();

  return {
    repoUrl: repo.html_url,
    commitSha: commitData.sha,
    pagesUrl: `https://${username}.github.io/${repoName}/`
  };
}

async function notifyEvaluationAPI(evaluationUrl, data) {
  const maxRetries = 5;
  const delays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(evaluationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        console.log('Successfully notified evaluation API');
        return;
      }

      console.log(`Evaluation API returned ${response.status}, retrying...`);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
    }

    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }

  throw new Error('Failed to notify evaluation API after retries');
}

function generateReadme(brief, checks) {
  return `# Project

## Summary
${brief}

## Setup
1. Clone this repository
2. Open \`index.html\` in a browser or use a local server

## Usage
Open the page and follow the interface instructions.

## Requirements Met
${checks.map(c => `- ${c}`).join('\n')}

## Code Explanation
This application is built as a single HTML file with embedded CSS and JavaScript for simplicity and ease of deployment.

## License
MIT License - See LICENSE file for details
`;
}

function getMITLicense() {
  const year = new Date().getFullYear();
  return `MIT License

Copyright (c) ${year}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
}




// const express = require('express');
// const { Octokit } = require('@octokit/rest');
// const { Configuration, OpenAIApi } = require('openai');
// require('dotenv').config();

// const app = express();
// const port = process.env.PORT || 3000;

// // Middleware
// app.use(express.json());
// app.use(require('cors')());

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
// });

// // Main deployment endpoint
// app.post('/api/deploy', async (req, res) => {
//   try {
//     // Validate request
//     const { secret, task, round, brief, checks, evaluation_url, attachments } = req.body;
    
//     if (secret !== process.env.SECRET_KEY) {
//       return res.status(401).json({ error: 'Invalid secret key' });
//     }

//     // Initialize GitHub client
//     const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

//     // Initialize OpenAI
//     const configuration = new Configuration({
//       apiKey: process.env.OPENAI_API_KEY,
//     });
//     const openai = new OpenAIApi(configuration);

//     // Generate code using OpenAI
//     const completion = await openai.createCompletion({
//       model: "text-davinci-003",
//       prompt: `Create a web application with: ${brief}\n\nRequirements:\n${checks.join('\n')}`,
//       max_tokens: 1000,
//     });

//     const generatedCode = completion.data.choices[0].text;

//     // Create GitHub repository
//     const repoName = `tds-${task}`;
//     await octokit.repos.createForAuthenticatedUser({
//       name: repoName,
//       private: false,
//       auto_init: true
//     });

//     // Create initial files
//     await octokit.repos.createOrUpdateFileContents({
//       owner: process.env.GITHUB_USERNAME,
//       repo: repoName,
//       path: 'index.html',
//       message: 'Initial commit with generated code',
//       content: Buffer.from(generatedCode).toString('base64')
//     });

//     // Enable GitHub Pages
//     await octokit.repos.createPagesSite({
//       owner: process.env.GITHUB_USERNAME,
//       repo: repoName,
//       source: {
//         branch: 'main',
//         path: '/'
//       }
//     });

//     // Return success response
//     res.status(200).json({
//       success: true,
//       message: 'Deployment successful',
//       url: `https://${process.env.GITHUB_USERNAME}.github.io/${repoName}`,
//       repo: `https://github.com/${process.env.GITHUB_USERNAME}/${repoName}`
//     });

//   } catch (error) {
//     console.error('Deployment error:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message,
//       details: error.response?.data || {}
//     });
//   }
// });

// // Start server
// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`);
// });

// module.exports = app;
