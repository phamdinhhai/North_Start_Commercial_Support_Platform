export interface PreviewMessage { id: string; source_id?: string; content: string; created_at: number; message_type: number }
export function filterDuplicateSourceMessages<T extends PreviewMessage>(messages?: T[]): T[];
export function getLastMessage<T extends PreviewMessage>(conversation: { messages: T[]; last_non_activity_message?: T }): T | undefined;
export function getReadMessages<T extends PreviewMessage>(messages: T[], lastSeenAt: number): T[];
export function getUnreadMessages<T extends PreviewMessage>(messages: T[], lastSeenAt: number): T[];
