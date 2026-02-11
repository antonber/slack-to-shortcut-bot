const SHORTCUT_BASE_URL = "https://api.app.shortcut.com/api/v3";

function getToken(): string {
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) throw new Error("SHORTCUT_API_TOKEN is not set");
  return token;
}

async function shortcutFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const { method = "GET", body } = options;
  const response = await fetch(`${SHORTCUT_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Shortcut-Token": getToken(),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shortcut API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// --- Story Operations ---

export async function createStory(params: {
  name: string;
  description?: string;
  story_type?: string;
  labels?: string[];
  owner_ids?: string[];
  workflow_state_id?: number;
  project_id?: number;
  estimate?: number;
}): Promise<unknown> {
  const body: Record<string, unknown> = {
    name: params.name,
  };

  if (params.description) body.description = params.description;
  if (params.story_type) body.story_type = params.story_type;
  if (params.labels) body.labels = params.labels.map((name) => ({ name }));
  if (params.owner_ids) body.owner_ids = params.owner_ids;
  if (params.estimate !== undefined) body.estimate = params.estimate;

  if (params.workflow_state_id) {
    body.workflow_state_id = params.workflow_state_id;
  } else if (process.env.SHORTCUT_WORKFLOW_STATE_ID) {
    body.workflow_state_id = Number(process.env.SHORTCUT_WORKFLOW_STATE_ID);
  }

  if (params.project_id) {
    body.project_id = params.project_id;
  } else if (process.env.SHORTCUT_PROJECT_ID) {
    body.project_id = Number(process.env.SHORTCUT_PROJECT_ID);
  }

  return shortcutFetch("/stories", { method: "POST", body });
}

export async function updateStory(
  storyId: number,
  params: Record<string, unknown>
): Promise<unknown> {
  return shortcutFetch(`/stories/${storyId}`, { method: "PUT", body: params });
}

export async function getStory(storyId: number): Promise<unknown> {
  return shortcutFetch(`/stories/${storyId}`);
}

export async function searchStories(query: string): Promise<unknown> {
  return shortcutFetch(
    `/search/stories?query=${encodeURIComponent(query)}`
  );
}

export async function addComment(
  storyId: number,
  text: string
): Promise<unknown> {
  return shortcutFetch(`/stories/${storyId}/comments`, {
    method: "POST",
    body: { text },
  });
}

// --- Reference Data ---

export async function listMembers(): Promise<unknown> {
  return shortcutFetch("/members");
}

export async function listWorkflowStates(): Promise<unknown> {
  return shortcutFetch("/workflows");
}

export async function listLabels(): Promise<unknown> {
  return shortcutFetch("/labels");
}

export async function listProjects(): Promise<unknown> {
  return shortcutFetch("/projects");
}
