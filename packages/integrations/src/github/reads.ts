import type { GitHubClient } from "./client.js";
import type { TimeRange, ActivityEvent } from "../types.js";

/** Creates dashboard read functions bound to a GitHubClient instance */
export function createReads(client: GitHubClient) {
  return {
    async getActivityFeed(range: TimeRange): Promise<ActivityEvent[]> {
      const events: ActivityEvent[] = [];

      for (const repo of client.allowedRepos) {
        // Merged PRs in range
        const mergedPRs = await client.searchIssues(
          `repo:${repo} is:pr is:merged merged:${range.since}..${range.until}`
        );

        for (const pr of mergedPRs) {
          events.push({
            id: `github-pr-${repo}-${pr.number}`,
            source: "github",
            type: "pr_merged",
            title: pr.title,
            description: `#${pr.number} merged by ${pr.user}`,
            actor: pr.user,
            timestamp: pr.closed_at ?? pr.updated_at,
            url: pr.url,
            metadata: { repo, number: pr.number },
          });
        }

        // Closed issues in range
        const closedIssues = await client.searchIssues(
          `repo:${repo} is:issue is:closed closed:${range.since}..${range.until}`
        );

        for (const issue of closedIssues) {
          events.push({
            id: `github-issue-${repo}-${issue.number}`,
            source: "github",
            type: "issue_closed",
            title: issue.title,
            description: `#${issue.number} closed by ${issue.user}`,
            actor: issue.user,
            timestamp: issue.closed_at ?? issue.updated_at,
            url: issue.url,
            metadata: { repo, number: issue.number },
          });
        }
      }

      return events.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },

    async getSummaryMetrics(
      range: TimeRange
    ): Promise<Record<string, number>> {
      let prs_merged = 0;
      let prs_opened = 0;
      let issues_opened = 0;
      let issues_closed = 0;
      let total_merge_hours = 0;

      for (const repo of client.allowedRepos) {
        const merged = await client.searchIssues(
          `repo:${repo} is:pr is:merged merged:${range.since}..${range.until}`
        );
        prs_merged += merged.length;

        // Compute merge time for each PR
        for (const pr of merged) {
          if (pr.closed_at) {
            const created = new Date(pr.created_at).getTime();
            const mergedAt = new Date(pr.closed_at).getTime();
            total_merge_hours += (mergedAt - created) / (1000 * 60 * 60);
          }
        }

        const opened = await client.searchIssues(
          `repo:${repo} is:pr created:${range.since}..${range.until}`
        );
        prs_opened += opened.length;

        const issuesOpened = await client.searchIssues(
          `repo:${repo} is:issue created:${range.since}..${range.until}`
        );
        issues_opened += issuesOpened.length;

        const issuesClosed = await client.searchIssues(
          `repo:${repo} is:issue is:closed closed:${range.since}..${range.until}`
        );
        issues_closed += issuesClosed.length;
      }

      return {
        prs_merged,
        prs_opened,
        issues_opened,
        issues_closed,
        avg_merge_hours: prs_merged > 0
          ? Math.round(total_merge_hours / prs_merged)
          : 0,
      };
    },
  };
}
