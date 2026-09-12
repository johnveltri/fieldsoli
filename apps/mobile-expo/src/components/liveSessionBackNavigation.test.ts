import { describe, expect, it } from '@jest/globals';

import { getAndroidLiveSessionBackAction } from './liveSessionBackNavigation';

const mainSheet = {
  mode: 'sheet' as const,
  noteFlow: 'closed' as const,
  materialFlow: 'closed' as const,
  editJobOpen: false,
};

describe('getAndroidLiveSessionBackAction', () => {
  it.each([
    [{ ...mainSheet, mode: 'editSheet' as const }, 'closeEditSheet'],
    [{ ...mainSheet, editJobOpen: true }, 'closeEditJob'],
    [{ ...mainSheet, noteFlow: 'attachSession' as const }, 'returnToNoteSheet'],
    [{ ...mainSheet, noteFlow: 'editSession' as const }, 'returnToNoteSheet'],
    [{ ...mainSheet, noteFlow: 'addNote' as const }, 'closeNoteFlow'],
    [{ ...mainSheet, noteFlow: 'editNote' as const }, 'closeNoteFlow'],
    [{ ...mainSheet, materialFlow: 'attachSession' as const }, 'returnToMaterialSheet'],
    [{ ...mainSheet, materialFlow: 'editSession' as const }, 'returnToMaterialSheet'],
    [{ ...mainSheet, materialFlow: 'chooseUnit' as const }, 'returnToMaterialSheet'],
    [{ ...mainSheet, materialFlow: 'addMaterial' as const }, 'closeMaterialFlow'],
    [{ ...mainSheet, materialFlow: 'editMaterial' as const }, 'closeMaterialFlow'],
    [mainSheet, 'minimize'],
    [{ ...mainSheet, mode: 'minimized' as const }, 'none'],
  ])('routes %o to %s', (input, expected) => {
    expect(getAndroidLiveSessionBackAction(input)).toBe(expected);
  });
});
