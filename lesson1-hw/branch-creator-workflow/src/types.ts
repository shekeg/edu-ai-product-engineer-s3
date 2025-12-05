export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string }>;
  user: {
    login: string;
  };
}

export interface BranchCreationResult {
  branchName: string;
  issueNumber: number;
  issueTitle: string;
  created: boolean;
  pushed: boolean;
  message: string;
}
