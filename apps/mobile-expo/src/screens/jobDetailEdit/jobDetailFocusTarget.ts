/** Client-only scroll target / Edit section scope when opening Job Edit from View or the complete wizard. */
export type JobDetailEditFocusTarget =
  | 'customer'
  | 'revenue'
  | 'metrics'
  | 'title'
  | 'sessions'
  | { kind: 'session'; id: string }
  | 'materials'
  | { kind: 'material'; id: string }
  | 'otherCosts'
  | { kind: 'otherCost'; id: string }
  | 'notes'
  | { kind: 'note'; id: string };

/** White-tile sections on Job Edit. `null` focusTarget (header EDIT) shows all. */
export type JobDetailEditSection =
  | 'title'
  | 'customer'
  | 'revenue'
  | 'sessions'
  | 'materials'
  | 'otherCosts'
  | 'notes';

export type JobEditOpenedSource =
  | 'header'
  | 'view_row'
  | 'view_empty'
  | 'complete_wizard'
  | 'customer';

/** Which Edit white tiles to show for a View/wizard entry. `null` → full Edit. */
export function editSectionsForFocusTarget(
  target: JobDetailEditFocusTarget | null,
): JobDetailEditSection[] | 'all' {
  if (target == null) return 'all';
  if (typeof target === 'string') {
    switch (target) {
      case 'title':
        return ['title'];
      case 'customer':
        return ['customer'];
      case 'revenue':
        return ['revenue'];
      case 'metrics':
        return ['revenue', 'materials', 'otherCosts'];
      case 'sessions':
        return ['sessions'];
      case 'materials':
        return ['materials'];
      case 'otherCosts':
        return ['otherCosts'];
      case 'notes':
        return ['notes'];
    }
  }
  switch (target.kind) {
    case 'session':
      return ['sessions'];
    case 'material':
      return ['materials'];
    case 'otherCost':
      return ['otherCosts'];
    case 'note':
      return ['notes'];
  }
}

export function editShowsSection(
  sections: JobDetailEditSection[] | 'all',
  section: JobDetailEditSection,
): boolean {
  return sections === 'all' || sections.includes(section);
}
