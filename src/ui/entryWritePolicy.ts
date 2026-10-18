import type {Entry} from '../core/model';
import {entryDragIntent,type EntryDragIntent} from './entryDragIntent';
export const requiresEditing=(entry:Entry,intent:EntryDragIntent=entryDragIntent(entry))=>intent==='training'||!['condition','item'].includes(entry.kind);
