import { GitHubIssue } from "./types.js";

export class GitHubClient {
  private token?: string;
  private baseUrl = "https://api.github.com";

  constructor(token?: string) {
    this.token = token;
  }

  private async fetch(url: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitHub-Branch-Creator",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `token ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`;
    return this.fetch(url);
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    baseBranch: string = "main"
  ): Promise<void> {
    if (!this.token) {
      throw new Error("GitHub token is required to create branches");
    }

    // Get the SHA of the base branch
    const baseBranchUrl = `${this.baseUrl}/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`;
    const baseBranchData = await this.fetch(baseBranchUrl);
    const baseSha = baseBranchData.object.sha;

    // Create new branch
    const createBranchUrl = `${this.baseUrl}/repos/${owner}/${repo}/git/refs`;
    await this.fetch(createBranchUrl, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    });
  }
}
