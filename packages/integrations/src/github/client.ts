import { Octokit } from "@octokit/rest";
import type { GitHubConfig } from "./config.js";
import type {
  PullRequestSummary,
  PullRequestDetail,
  IssueSummary,
  CommitSummary,
} from "./types.js";

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.token });
  }

  private parseRepo(repo: string): { owner: string; repo: string } {
    const [owner, name] = repo.split("/");
    if (!owner || !name) {
      throw new Error(
        `Invalid repo format "${repo}". Expected "owner/repo".`
      );
    }
    return { owner, repo: name };
  }

  private validateRepo(repo: string): void {
    if (
      this.config.allowedRepos.length > 0 &&
      !this.config.allowedRepos.includes(repo)
    ) {
      throw new Error(
        `Repository "${repo}" is not in the allowed list. Allowed: ${this.config.allowedRepos.join(", ")}`
      );
    }
  }

  /** Resolve repo: use provided value, fall back to single allowed repo, or error */
  resolveRepo(repo?: string): string {
    if (repo) return repo;
    if (this.config.allowedRepos.length === 1) {
      return this.config.allowedRepos[0];
    }
    throw new Error(
      `No repo specified. Available repos: ${this.config.allowedRepos.join(", ")}`
    );
  }

  get allowedRepos(): string[] {
    return this.config.allowedRepos;
  }

  async listPRs(
    repo: string,
    options: {
      state?: "open" | "closed" | "all";
      per_page?: number;
    } = {}
  ): Promise<PullRequestSummary[]> {
    this.validateRepo(repo);
    const { owner, repo: name } = this.parseRepo(repo);
    const { state = "open", per_page = 20 } = options;

    const { data } = await this.octokit.pulls.list({
      owner,
      repo: name,
      state,
      per_page,
      sort: "updated",
      direction: "desc",
    });

    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login ?? "unknown",
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      merged_at: pr.merged_at,
      draft: pr.draft ?? false,
      labels: pr.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
      head_branch: pr.head.ref,
      base_branch: pr.base.ref,
      url: pr.html_url,
    }));
  }

  async getPR(repo: string, prNumber: number): Promise<PullRequestDetail> {
    this.validateRepo(repo);
    const { owner, repo: name } = this.parseRepo(repo);

    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo: name,
      pull_number: prNumber,
    });

    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner,
      repo: name,
      pull_number: prNumber,
    });

    const reviewers = [
      ...new Set(reviews.map((r) => r.user?.login).filter(Boolean)),
    ] as string[];

    return {
      number: pr.number,
      title: pr.title,
      state: pr.merged ? "merged" : pr.state,
      user: pr.user?.login ?? "unknown",
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      merged_at: pr.merged_at,
      draft: pr.draft ?? false,
      labels: pr.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
      head_branch: pr.head.ref,
      base_branch: pr.base.ref,
      url: pr.html_url,
      body: pr.body ?? "",
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
      commits: pr.commits,
      reviewers,
    };
  }

  async listIssues(
    repo: string,
    options: {
      state?: "open" | "closed" | "all";
      labels?: string;
      per_page?: number;
    } = {}
  ): Promise<IssueSummary[]> {
    this.validateRepo(repo);
    const { owner, repo: name } = this.parseRepo(repo);
    const { state = "open", labels, per_page = 20 } = options;

    const { data } = await this.octokit.issues.listForRepo({
      owner,
      repo: name,
      state,
      labels,
      per_page,
      sort: "updated",
      direction: "desc",
    });

    // Filter out pull requests (GitHub API returns them under issues)
    return data
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        user: issue.user?.login ?? "unknown",
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        labels: issue.labels.map((l) =>
          typeof l === "string" ? l : l.name ?? ""
        ),
        assignees: issue.assignees?.map((a) => a.login) ?? [],
        url: issue.html_url,
      }));
  }

  async searchIssues(
    query: string,
    options: { per_page?: number } = {}
  ): Promise<(IssueSummary & { repo: string; is_pr: boolean })[]> {
    const { per_page = 20 } = options;

    // Scope search to allowed repos if configured
    let scopedQuery = query;
    if (this.config.allowedRepos.length > 0) {
      const repoFilters = this.config.allowedRepos
        .map((r) => `repo:${r}`)
        .join(" ");
      scopedQuery = `${repoFilters} ${query}`;
    } else if (this.config.defaultOrg) {
      scopedQuery = `org:${this.config.defaultOrg} ${query}`;
    }

    const { data } = await this.octokit.search.issuesAndPullRequests({
      q: scopedQuery,
      per_page,
      sort: "updated",
      order: "desc",
    });

    return data.items.map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      user: item.user?.login ?? "unknown",
      created_at: item.created_at,
      updated_at: item.updated_at,
      closed_at: item.closed_at,
      labels: item.labels.map((l) =>
        typeof l === "string" ? l : l.name ?? ""
      ),
      assignees: item.assignees?.map((a) => a.login) ?? [],
      url: item.html_url,
      repo: item.repository_url.replace(
        "https://api.github.com/repos/",
        ""
      ),
      is_pr: !!item.pull_request,
    }));
  }

  async recentCommits(
    repo: string,
    options: { branch?: string; per_page?: number; since?: string } = {}
  ): Promise<CommitSummary[]> {
    this.validateRepo(repo);
    const { owner, repo: name } = this.parseRepo(repo);
    const { branch, per_page = 20, since } = options;

    const { data } = await this.octokit.repos.listCommits({
      owner,
      repo: name,
      sha: branch,
      per_page,
      since,
    });

    return data.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0],
      author: c.author?.login ?? c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? "",
      url: c.html_url,
    }));
  }
}
