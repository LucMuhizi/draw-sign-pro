import { getItem, setItem, removeItem, getKeysByPrefix } from './storage';
import type { SignaturePlacement, FieldType, PlacementRange } from './pdfSigner';

const TEMPLATE_PREFIX = 'signdocu-template';

/**
 * Phase 2 P2.4 — placements stored in a template carry their full
 * coord metadata so range placements round-trip correctly across
 * sessions / devices / users. `range` is the optional multi-page span,
 * and `coordsNormalized: true` marks the placement as a range whose
 * x/y/w/h are ratios in [0..1] of each page's display dimensions
 * (instead of pixel values). The flag is set automatically when
 * `range` is present; keeping an explicit field avoids re-deriving it
 * at unmarshal time.
 */
export interface DocumentTemplate {
  id: string;
  name: string;
  documentName: string;
  pageCount: number;
  placements: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    fieldType: FieldType;
    typedText?: string;
    dateFormat?: string;
    /** Multi-page span — only present on range placements. */
    range?: PlacementRange;
    /**
     * True when x/y/w/h are normalized to [0..1] rather than pixels.
     * Single-page placements leave this undefined; range placements
     * have it set so the load path uses ratio scaling.
     */
    coordsNormalized?: boolean;
  }>;
  createdAt: number;
}

export async function getTemplates(): Promise<DocumentTemplate[]> {
  try {
    const keys = await getKeysByPrefix(TEMPLATE_PREFIX);
    const templates = await Promise.all(keys.map(k => getItem<DocumentTemplate>(k)));
    return templates
      .filter(Boolean)
      .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0)) as DocumentTemplate[];
  } catch {
    return [];
  }
}

export async function saveTemplate(
  name: string,
  documentName: string,
  pageCount: number,
  placements: SignaturePlacement[],
): Promise<DocumentTemplate> {
  const template: DocumentTemplate = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    documentName,
    pageCount,
    placements: placements.map(p => {
      const isRange = !!p.range;
      return {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        page: p.page,
        fieldType: p.fieldType || 'signature',
        typedText: p.typedText,
        dateFormat: p.dateFormat,
        range: p.range,
        coordsNormalized: isRange ? true : undefined,
      };
    }),
    createdAt: Date.now(),
  };
  await setItem(`${TEMPLATE_PREFIX}_${template.id}`, template);
  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await removeItem(`${TEMPLATE_PREFIX}_${id}`);
}

/**
 * Convert template placements to live SignaturePlacement objects with unique IDs.
 *
 * Range placements carry their `range` shape and normalized coords
 * across unmarshal. The `coordsNormalized: true` flag is preserved
 * implicitly via the presence of `range`.
 */
export function templateToPlacements(
  template: DocumentTemplate,
): SignaturePlacement[] {
  return template.placements.map(p => ({
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    page: p.page,
    fieldType: p.fieldType,
    typedText: p.typedText,
    dateFormat: p.dateFormat,
    checked: false,
    // Range metadata — carries both the span and the normalised-coords
    // contract that the render + export layers look for.
    range: p.range,
  }));
}
