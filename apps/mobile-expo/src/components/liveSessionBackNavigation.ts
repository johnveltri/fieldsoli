export type LiveSessionPresentationMode = 'hidden' | 'sheet' | 'minimized' | 'editSheet';

export type NoteFlow = 'closed' | 'addNote' | 'editNote' | 'attachSession' | 'editSession';

export type MaterialFlow =
  | 'closed'
  | 'addMaterial'
  | 'editMaterial'
  | 'attachSession'
  | 'editSession'
  | 'chooseUnit';

export type AndroidLiveSessionBackAction =
  | 'closeEditSheet'
  | 'closeEditJob'
  | 'returnToNoteSheet'
  | 'closeNoteFlow'
  | 'returnToMaterialSheet'
  | 'closeMaterialFlow'
  | 'minimize'
  | 'none';

/**
 * Android routes hardware Back through the visible live-session layer before
 * minimizing the session. This keeps an in-progress note or material draft
 * intact when its picker is dismissed.
 */
export function getAndroidLiveSessionBackAction({
  mode,
  noteFlow,
  materialFlow,
  editJobOpen,
}: {
  mode: LiveSessionPresentationMode;
  noteFlow: NoteFlow;
  materialFlow: MaterialFlow;
  editJobOpen: boolean;
}): AndroidLiveSessionBackAction {
  if (mode === 'editSheet') return 'closeEditSheet';
  if (mode !== 'sheet') return 'none';
  if (editJobOpen) return 'closeEditJob';
  if (noteFlow === 'attachSession' || noteFlow === 'editSession') return 'returnToNoteSheet';
  if (noteFlow === 'addNote' || noteFlow === 'editNote') return 'closeNoteFlow';
  if (
    materialFlow === 'attachSession' ||
    materialFlow === 'editSession' ||
    materialFlow === 'chooseUnit'
  ) {
    return 'returnToMaterialSheet';
  }
  if (materialFlow === 'addMaterial' || materialFlow === 'editMaterial') {
    return 'closeMaterialFlow';
  }
  return 'minimize';
}
