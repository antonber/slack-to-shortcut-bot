export interface ShortcutConfig {
  token: string;
  defaultProjectId?: number;
  defaultWorkflowStateId?: number;
}

export function loadShortcutConfig(): ShortcutConfig | null {
  const token = process.env.SHORTCUT_API_TOKEN;
  if (!token) return null;

  return {
    token,
    defaultProjectId: process.env.SHORTCUT_PROJECT_ID
      ? Number(process.env.SHORTCUT_PROJECT_ID)
      : undefined,
    defaultWorkflowStateId: process.env.SHORTCUT_WORKFLOW_STATE_ID
      ? Number(process.env.SHORTCUT_WORKFLOW_STATE_ID)
      : undefined,
  };
}
