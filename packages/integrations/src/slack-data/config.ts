export interface SlackDataConfig {
  token: string;
}

export function loadSlackDataConfig(): SlackDataConfig | null {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  // Requires explicit opt-in since extra OAuth scopes (search:read) are needed
  if (!process.env.SLACK_DATA_ENABLED) return null;
  return { token };
}
