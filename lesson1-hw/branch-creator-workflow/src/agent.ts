import Anthropic from "@anthropic-ai/sdk";
import { GitHubClient } from "./github.js";
import { BranchCreationResult } from "./types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class BranchCreatorAgent {
  private client: Anthropic;
  private githubClient: GitHubClient;
  private readonly model = "claude-3-opus-20240229";

  constructor(apiKey: string, githubToken?: string) {
    this.client = new Anthropic({ apiKey });
    this.githubClient = new GitHubClient(githubToken);
  }

  private async generateConciseName(issueTitle: string): Promise<string> {
    console.log("🤖 Asking Claude to generate a concise branch name...");

    const prompt = `Given this GitHub issue title, generate a concise branch name (2-4 words max, kebab-case).

Issue title: "${issueTitle}"

Rules:
- Use lowercase letters only
- Use hyphens (-) to separate words
- Keep it short and descriptive (2-4 words)
- Remove articles (a, an, the)
- Focus on the key action or feature

Examples:
"Add user authentication feature" -> "add-user-auth"
"Fix: Memory leak in data processing" -> "fix-memory-leak"
"Update documentation for API endpoints" -> "update-api-docs"

Respond with ONLY the branch name, no explanation.`;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const branchName =
      message.content[0].type === "text"
        ? message.content[0].text.trim().toLowerCase()
        : "feature";

    return branchName;
  }

  async createBranchFromIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    baseBranch: string = "main"
  ): Promise<BranchCreationResult> {
    console.log(`\n🚀 Starting Branch Creator Agent...`);
    console.log(`📋 Repository: ${owner}/${repo}`);
    console.log(`🎯 Issue #${issueNumber}\n`);

    try {
      // Step 1: Fetch the issue
      console.log("📖 Step 1: Fetching GitHub issue...");
      const issue = await this.githubClient.getIssue(owner, repo, issueNumber);

      console.log(`✅ Issue found: "${issue.title}"`);
      console.log(`   State: ${issue.state}`);
      console.log(`   Author: ${issue.user.login}`);
      console.log(`   Created: ${new Date(issue.created_at).toLocaleDateString()}`);

      if (issue.state !== "open") {
        console.log(`⚠️  Warning: Issue is ${issue.state}, not open`);
      }

      // Step 2: Generate concise branch name using Claude
      console.log("\n🔤 Step 2: Generating concise branch name...");
      const conciseName = await this.generateConciseName(issue.title);
      const branchName = `issue-${issueNumber}/${conciseName}`;

      console.log(`✅ Generated branch name: ${branchName}`);

      // Step 3: Create branch via GitHub API
      console.log(`\n🌿 Step 3: Creating branch on GitHub...`);
      await this.githubClient.createBranch(owner, repo, branchName, baseBranch);
      console.log(`✅ Branch created successfully on GitHub`);

      // Step 4: Push to origin (fetch and checkout locally, then push)
      console.log(`\n📤 Step 4: Setting up local branch and pushing to origin...`);

      try {
        // Fetch the newly created branch
        await execAsync(`git fetch origin ${branchName}`);
        console.log(`✅ Fetched branch from origin`);

        // Checkout the branch
        await execAsync(`git checkout ${branchName}`);
        console.log(`✅ Checked out branch locally`);

        // The branch is already on origin (created via API), so we're done
        console.log(`✅ Branch is ready and tracking origin/${branchName}`);

        return {
          branchName,
          issueNumber,
          issueTitle: issue.title,
          created: true,
          pushed: true,
          message: `Successfully created and pushed branch: ${branchName}`,
        };
      } catch (gitError: any) {
        console.warn(`⚠️  Git operations warning: ${gitError.message}`);
        console.log(`ℹ️  Branch exists on GitHub but local git operations had issues`);

        return {
          branchName,
          issueNumber,
          issueTitle: issue.title,
          created: true,
          pushed: true,
          message: `Branch created on GitHub: ${branchName}. Manual checkout may be needed.`,
        };
      }
    } catch (error: any) {
      console.error("❌ Error:", error.message);

      return {
        branchName: "",
        issueNumber,
        issueTitle: "",
        created: false,
        pushed: false,
        message: `Failed to create branch: ${error.message}`,
      };
    }
  }

  async run(
    owner: string,
    repo: string,
    issueNumber: number,
    baseBranch?: string
  ): Promise<void> {
    const result = await this.createBranchFromIssue(
      owner,
      repo,
      issueNumber,
      baseBranch
    );

    console.log("\n" + "=".repeat(80));
    console.log(`📊 BRANCH CREATION SUMMARY`);
    console.log("=".repeat(80));
    console.log(`Issue #${result.issueNumber}: ${result.issueTitle}`);
    console.log(`Branch: ${result.branchName}`);
    console.log(`Created: ${result.created ? "✅" : "❌"}`);
    console.log(`Pushed: ${result.pushed ? "✅" : "❌"}`);
    console.log(`\n${result.message}`);
    console.log("=".repeat(80));
  }
}
