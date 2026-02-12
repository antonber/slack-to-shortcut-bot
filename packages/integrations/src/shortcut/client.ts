import { fetchWithRetry } from "../fetch-utils.js";
import type { ShortcutConfig } from "./config.js";
import type { CreateStoryParams, UpdateStoryParams } from "./types.js";

const BASE_URL = "https://api.app.shortcut.com/api/v3";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for reference data

export class ShortcutClient {
  constructor(private config: ShortcutConfig) {}

  private request(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<unknown> {
    return fetchWithRetry(`${BASE_URL}${path}`, {
      method: options.method,
      headers: { "Shortcut-Token": this.config.token },
      body: options.body,
    });
  }

  // --- Story Operations ---

  async createStory(params: CreateStoryParams): Promise<unknown> {
    const body: Record<string, unknown> = { name: params.name };

    if (params.description) body.description = params.description;
    if (params.story_type) body.story_type = params.story_type;
    if (params.labels) body.labels = params.labels.map((name) => ({ name }));
    if (params.owner_ids) body.owner_ids = params.owner_ids;
    if (params.estimate !== undefined) body.estimate = params.estimate;

    if (params.workflow_state_id) {
      body.workflow_state_id = params.workflow_state_id;
    } else if (this.config.defaultWorkflowStateId) {
      body.workflow_state_id = this.config.defaultWorkflowStateId;
    }

    if (params.project_id) {
      body.project_id = params.project_id;
    } else if (this.config.defaultProjectId) {
      body.project_id = this.config.defaultProjectId;
    }

    return this.request("/stories", { method: "POST", body });
  }

  async updateStory(
    storyId: number,
    params: UpdateStoryParams
  ): Promise<unknown> {
    return this.request(`/stories/${storyId}`, { method: "PUT", body: params });
  }

  async getStory(storyId: number): Promise<unknown> {
    return this.request(`/stories/${storyId}`);
  }

  async searchStories(query: string): Promise<unknown> {
    return this.request(
      `/search/stories?query=${encodeURIComponent(query)}`
    );
  }

  async addComment(storyId: number, text: string): Promise<unknown> {
    return this.request(`/stories/${storyId}/comments`, {
      method: "POST",
      body: { text },
    });
  }

  // --- Reference Data (cached) ---

  async listMembers(): Promise<unknown> {
    return fetchWithRetry(`${BASE_URL}/members`, {
      headers: { "Shortcut-Token": this.config.token },
      cache: { key: "shortcut:members", ttlMs: CACHE_TTL },
    });
  }

  async listWorkflowStates(): Promise<unknown> {
    return fetchWithRetry(`${BASE_URL}/workflows`, {
      headers: { "Shortcut-Token": this.config.token },
      cache: { key: "shortcut:workflows", ttlMs: CACHE_TTL },
    });
  }

  async listLabels(): Promise<unknown> {
    return fetchWithRetry(`${BASE_URL}/labels`, {
      headers: { "Shortcut-Token": this.config.token },
      cache: { key: "shortcut:labels", ttlMs: CACHE_TTL },
    });
  }

  async listProjects(): Promise<unknown> {
    return fetchWithRetry(`${BASE_URL}/projects`, {
      headers: { "Shortcut-Token": this.config.token },
      cache: { key: "shortcut:projects", ttlMs: CACHE_TTL },
    });
  }
}
