import 'dotenv/config';
import { LogAnalyzerAgent } from './agent.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // Validate environment variables
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY not found in environment variables');
    console.error('Please create a .env file based on .env.example');
    process.exit(1);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.warn('⚠️  Warning: GITHUB_TOKEN not found. API rate limits will be lower.');
  }

  // Configuration
  const logsPath = process.env.LOGS_PATH || join(__dirname, '..', 'logs.json');
  const githubRepo = process.env.GITHUB_REPO || 'shekeg/ai-feature-flags';

  // Create and run agent
  const agent = new LogAnalyzerAgent(apiKey, githubToken);
  await agent.run(logsPath, githubRepo);
}

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
