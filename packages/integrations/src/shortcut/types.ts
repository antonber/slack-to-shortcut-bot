export interface CreateStoryParams {
  name: string;
  description?: string;
  story_type?: string;
  labels?: string[];
  owner_ids?: string[];
  workflow_state_id?: number;
  project_id?: number;
  estimate?: number;
}

export interface UpdateStoryParams {
  name?: string;
  description?: string;
  story_type?: string;
  owner_ids?: string[];
  workflow_state_id?: number;
  estimate?: number;
  labels?: { name: string }[];
}
