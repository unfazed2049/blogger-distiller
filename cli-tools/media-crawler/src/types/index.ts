/**
 * Common TypeScript types used across the application
 * These types are platform-agnostic and used by both providers and adapters
 */

// Re-export provider types
export type { BloggerInfo, Profile, NotesList, NoteDetail } from '../providers/base';

// Re-export platform types
export type { Note, Comment, PlatformAdapter } from '../platforms/base';

// Common utility types
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export interface PaginationInfo {
  hasMore: boolean;
  cursor?: string;
  total?: number;
}
