import { ShareableEntityType } from '../enums/shareable-entity-type';

export interface ShareableLinkOptions {
  query_params?: Record<string, string | number | boolean>;
  use_short_url?: boolean;
  /** Overrides the default query key for this entity (e.g. `user`, `event`). */
  custom_path?: string;
}

export interface ShareableLinkResult {
  url: string;
  entity_type: ShareableEntityType;
  entity_id: string;
  path: string;
}

export interface IShareableEntity {
  id: string;
  get_shareable_type(): ShareableEntityType;
  get_shareable_identifier(): string;
  get_shareable_metadata?(): Record<string, any>;
}
