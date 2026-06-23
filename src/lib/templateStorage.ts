import { getItem, setItem, removeItem, getKeysByPrefix } from './storage';
import type { SignaturePlacement, FieldType } from './pdfSigner';

const TEMPLATE_PREFIX = 'signdocu-template';

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
    placements: placements.map(p => ({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      page: p.page,
      fieldType: p.fieldType || 'signature',
      typedText: p.typedText,
      dateFormat: p.dateFormat,
    })),
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
  }));
}
