import { Client } from "@notionhq/client";
import type { NotionConfig } from "./config.js";
import type { NotionPageSummary, NotionDatabaseRow } from "./types.js";

export class NotionClient {
  private notion: Client;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    this.config = config;
    this.notion = new Client({ auth: config.token });
  }

  private validateDatabase(databaseId: string): void {
    if (
      this.config.allowedDatabases.length > 0 &&
      !this.config.allowedDatabases.includes(databaseId)
    ) {
      throw new Error(
        `Database "${databaseId}" is not in the allowed list. Allowed: ${this.config.allowedDatabases.join(", ")}`
      );
    }
  }

  /** Extract a human-readable title from Notion properties */
  private extractTitle(
    properties: Record<string, unknown>
  ): string {
    for (const prop of Object.values(properties)) {
      const p = prop as Record<string, unknown>;
      if (p.type === "title" && Array.isArray(p.title)) {
        return (p.title as Array<{ plain_text?: string }>)
          .map((t) => t.plain_text ?? "")
          .join("");
      }
    }
    return "Untitled";
  }

  /** Simplify a Notion property value to a readable string */
  private simplifyProperty(prop: Record<string, unknown>): string {
    switch (prop.type) {
      case "title":
        return (prop.title as Array<{ plain_text?: string }>)
          ?.map((t) => t.plain_text)
          .join("") ?? "";
      case "rich_text":
        return (prop.rich_text as Array<{ plain_text?: string }>)
          ?.map((t) => t.plain_text)
          .join("") ?? "";
      case "number":
        return String(prop.number ?? "");
      case "select":
        return (prop.select as { name?: string })?.name ?? "";
      case "multi_select":
        return (prop.multi_select as Array<{ name?: string }>)
          ?.map((s) => s.name)
          .join(", ") ?? "";
      case "date":
        return (prop.date as { start?: string })?.start ?? "";
      case "checkbox":
        return String(prop.checkbox ?? false);
      case "url":
        return String(prop.url ?? "");
      case "email":
        return String(prop.email ?? "");
      case "status":
        return (prop.status as { name?: string })?.name ?? "";
      case "people":
        return (prop.people as Array<{ name?: string }>)
          ?.map((p) => p.name)
          .join(", ") ?? "";
      default:
        return "";
    }
  }

  async search(
    query: string,
    options: { page_size?: number } = {}
  ): Promise<NotionPageSummary[]> {
    const { page_size = 20 } = options;

    const response = await this.notion.search({
      query,
      page_size,
      sort: { direction: "descending", timestamp: "last_edited_time" },
    });

    return response.results.map((result) => {
      const r = result as Record<string, unknown>;
      const properties = (r.properties ?? {}) as Record<string, unknown>;
      return {
        id: r.id as string,
        title: this.extractTitle(properties),
        url: (r.url as string) ?? "",
        last_edited_time: (r.last_edited_time as string) ?? "",
        created_time: (r.created_time as string) ?? "",
        type: (r.object === "database" ? "database" : "page") as
          | "page"
          | "database",
      };
    });
  }

  async getPage(pageId: string): Promise<{
    id: string;
    title: string;
    url: string;
    properties: Record<string, string>;
    last_edited_time: string;
  }> {
    const page = (await this.notion.pages.retrieve({
      page_id: pageId,
    })) as Record<string, unknown>;

    const properties = (page.properties ?? {}) as Record<
      string,
      Record<string, unknown>
    >;

    const simplified: Record<string, string> = {};
    for (const [key, value] of Object.entries(properties)) {
      const val = this.simplifyProperty(value);
      if (val) simplified[key] = val;
    }

    return {
      id: page.id as string,
      title: this.extractTitle(properties),
      url: (page.url as string) ?? "",
      properties: simplified,
      last_edited_time: (page.last_edited_time as string) ?? "",
    };
  }

  async queryDatabase(
    databaseId: string,
    options: { page_size?: number; filter?: Record<string, unknown> } = {}
  ): Promise<NotionDatabaseRow[]> {
    this.validateDatabase(databaseId);
    const { page_size = 50, filter } = options;

    // Use pages search scoped to database as the SDK types for databases.query vary by version
    const queryFn = (this.notion.databases as any).query.bind(
      this.notion.databases
    ) as (args: Record<string, unknown>) => Promise<{ results: unknown[] }>;

    const response = await queryFn({
      database_id: databaseId,
      page_size,
      ...(filter ? { filter } : {}),
    });

    return response.results.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const properties = (r.properties ?? {}) as Record<
        string,
        Record<string, unknown>
      >;

      const simplified: Record<string, string> = {};
      for (const [key, value] of Object.entries(properties)) {
        const val = this.simplifyProperty(value);
        if (val) simplified[key] = val;
      }

      return {
        id: r.id as string,
        url: (r.url as string) ?? "",
        properties: simplified,
        last_edited_time: (r.last_edited_time as string) ?? "",
      };
    });
  }

  /** Search for recently edited pages (for dashboard reads) */
  async recentlyEdited(
    since: string,
    options: { page_size?: number } = {}
  ): Promise<NotionPageSummary[]> {
    const { page_size = 100 } = options;

    const response = await this.notion.search({
      page_size,
      sort: { direction: "descending", timestamp: "last_edited_time" },
      filter: { property: "object", value: "page" },
    });

    const sinceDate = new Date(since).getTime();
    return response.results
      .map((result) => {
        const r = result as Record<string, unknown>;
        const properties = (r.properties ?? {}) as Record<string, unknown>;
        return {
          id: r.id as string,
          title: this.extractTitle(properties),
          url: (r.url as string) ?? "",
          last_edited_time: (r.last_edited_time as string) ?? "",
          created_time: (r.created_time as string) ?? "",
          type: "page" as const,
        };
      })
      .filter(
        (p) => new Date(p.last_edited_time).getTime() >= sinceDate
      );
  }
}
