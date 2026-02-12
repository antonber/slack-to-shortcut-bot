export interface NotionConfig {
  token: string;
  allowedDatabases: string[];
}

export function loadNotionConfig(): NotionConfig | null {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;

  return {
    token,
    allowedDatabases: (process.env.NOTION_ALLOWED_DATABASES ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
}
