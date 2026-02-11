import { ShortcutTicket } from "./types";

const SHORTCUT_BASE_URL = "https://api.app.shortcut.com/api/v3";

interface ShortcutStoryResponse {
  id: number;
  app_url: string;
}

export async function createStory(
  ticket: ShortcutTicket
): Promise<{ id: number; url: string }> {
  const token = process.env.SHORTCUT_API_TOKEN;
  const projectId = Number(process.env.SHORTCUT_PROJECT_ID);
  const workflowStateId = Number(process.env.SHORTCUT_WORKFLOW_STATE_ID);

  if (!token) throw new Error("SHORTCUT_API_TOKEN is not set");

  const body: Record<string, unknown> = {
    name: ticket.name,
    description: ticket.description,
    story_type: ticket.story_type,
    project_id: projectId,
    workflow_state_id: workflowStateId,
    labels: ticket.labels.map((name) => ({ name })),
  };

  if (ticket.estimate !== null) {
    body.estimate = ticket.estimate;
  }

  const response = await fetch(`${SHORTCUT_BASE_URL}/stories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Shortcut-Token": token,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shortcut API error (${response.status}): ${errorText}`);
  }

  const story = (await response.json()) as ShortcutStoryResponse;
  return {
    id: story.id,
    url: story.app_url,
  };
}
