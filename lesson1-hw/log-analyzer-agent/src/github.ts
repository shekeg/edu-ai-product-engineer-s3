export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  user: {
    login: string;
  };
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  state: string;
}

export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export class GitHubClient {
  private readonly baseUrl = 'https://api.github.com';
  private readonly token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private async fetch(url: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'log-analyzer-agent'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getRecentPRs(owner: string, repo: string, limit: number = 10): Promise<GitHubPR[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${limit}`;
    return this.fetch(url);
  }

  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFile[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    return this.fetch(url);
  }

  async getPR(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    return this.fetch(url);
  }
}
