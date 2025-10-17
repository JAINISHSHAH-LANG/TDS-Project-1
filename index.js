const express = require('express');
const { Octokit } = require('@octokit/rest');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(require('cors')());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main deployment endpoint
app.post('/api/deploy', async (req, res) => {
  try {
    // Validate request
    const { secret, task, round, brief, checks, evaluation_url, attachments } = req.body;
    
    if (secret !== process.env.SECRET_KEY) {
      return res.status(401).json({ error: 'Invalid secret key' });
    }

    // Initialize GitHub client
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Initialize OpenAI
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    // Generate code using OpenAI
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `Create a web application with: ${brief}\n\nRequirements:\n${checks.join('\n')}`,
      max_tokens: 1000,
    });

    const generatedCode = completion.data.choices[0].text;

    // Create GitHub repository
    const repoName = `tds-${task}`;
    await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true
    });

    // Create initial files
    await octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_USERNAME,
      repo: repoName,
      path: 'index.html',
      message: 'Initial commit with generated code',
      content: Buffer.from(generatedCode).toString('base64')
    });

    // Enable GitHub Pages
    await octokit.repos.createPagesSite({
      owner: process.env.GITHUB_USERNAME,
      repo: repoName,
      source: {
        branch: 'main',
        path: '/'
      }
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Deployment successful',
      url: `https://${process.env.GITHUB_USERNAME}.github.io/${repoName}`,
      repo: `https://github.com/${process.env.GITHUB_USERNAME}/${repoName}`
    });

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.response?.data || {}
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = app;
