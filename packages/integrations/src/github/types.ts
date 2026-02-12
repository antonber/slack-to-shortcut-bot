export interface PullRequestSummary {
  number: number;
  title: string;
  state: string;
  user: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft: boolean;
  labels: string[];
  head_branch: string;
  base_branch: string;
  url: string;
}

export interface PullRequestDetail extends PullRequestSummary {
  body: string;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  reviewers: string[];
}

export interface IssueSummary {
  number: number;
  title: string;
  state: string;
  user: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: string[];
  assignees: string[];
  url: string;
}

export interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}
