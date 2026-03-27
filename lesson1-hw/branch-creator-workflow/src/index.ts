import "dotenv/config";
import { BranchCreatorAgent } from "./agent.js";

async function main() {
  // Validate environment variables
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: ANTHROPIC_API_KEY not found in environment variables");
    console.error("Please create a .env file based on .env.example");
    process.exit(1);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("❌ Error: GITHUB_TOKEN not found in environment variables");
    console.error("GITHUB_TOKEN is required to create branches");
    console.error("Please create a .env file based on .env.example");
    process.exit(1);
  }

  const githubRepo = process.env.GITHUB_REPO;
  if (!githubRepo) {
    console.error("❌ Error: GITHUB_REPO not found in environment variables");
    console.error("Please create a .env file based on .env.example");
    process.exit(1);
  }

  if (!githubRepo.includes("/")) {
    console.error("❌ GITHUB_REPO must be in format: owner/repo");
    process.exit(1);
  }

  const baseBranch = process.env.BASE_BRANCH || "main";

  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("❌ Usage: npm run dev <issue-number>");
    console.error("   Example: npm run dev 42");
    process.exit(1);
  }

  const issueNumber = parseInt(args[0], 10);

  if (isNaN(issueNumber) || issueNumber <= 0) {
    console.error("❌ Issue number must be a positive integer");
    process.exit(1);
  }

  const [owner, repo] = githubRepo.split("/");

  // Create and run agent
  const agent = new BranchCreatorAgent(apiKey, githubToken);
  await agent.run(owner, repo, issueNumber, baseBranch);
}

main().catch((error) => {
  console.error("💥 Unhandled error:", error);
  process.exit(1);
});
