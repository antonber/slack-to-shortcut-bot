export interface NotionPageSummary {
  id: string;
  title: string;
  url: string;
  last_edited_time: string;
  created_time: string;
  type: "page" | "database";
}

export interface NotionDatabaseRow {
  id: string;
  url: string;
  properties: Record<string, string>;
  last_edited_time: string;
}
