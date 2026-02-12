export interface GitHubConfig {
  token: string;
  allowedRepos: string[];
  defaultOrg: string;
}

export function loadGitHubConfig(): GitHubConfig | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  return {
    token,
    allowedRepos: (process.env.GITHUB_REPOS ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean),
    defaultOrg: process.env.GITHUB_ORG ?? "",
  };
}
