/**
 * Convert .docx files to HTML using mammoth.js.
 * Runs entirely client-side — no server required.
 */

/**
 * Supported Word file extensions
 */
export const DOCX_EXTENSIONS = ['.docx', '.doc'];
export const DOCX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-word',
];

/**
 * Check if a file is a Word document by extension or MIME type.
 */
export function isDocxFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (DOCX_EXTENSIONS.some(ext => lower.endsWith(ext))) return true;
  if (DOCX_MIME_TYPES.includes(file.type)) return true;
  // Some browsers/OS don't set the correct MIME for .docx
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return true;
  return false;
}

export interface DocxConvertResult {
  html: string;
  /** Any warnings from mammoth about formatting that couldn't be converted */
  warnings: string[];
}

/**
 * Convert a .docx file to HTML.
 * Returns structured HTML with semantic elements (h1-h6, p, ul, table, etc.)
 */
export async function convertDocxToHtml(file: File): Promise<DocxConvertResult> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      // Style mapping: map Word styles to HTML/CSS
      styleMap: [
        "p[style-name='Signature Line'] => p.signature-line:separator('\\n')",
        "p[style-name='Date Line'] => p.date-line:separator('\\n')",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
      ],
      // Don't embed images as base64 (keeps output small)
      convertImage: mammoth.images.imgElement((image: { contentType: string; read: () => Promise<ArrayBuffer> }) => {
        return image.read().then((buffer) => {
          // Mammoth returns ArrayBuffer in browser (not Node Buffer)
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          return {
            src: `data:${image.contentType};base64,${base64}`,
          };
        });
      }),
    },
  );

  return {
    html: result.value,
    warnings: result.messages
      .filter(m => m.type === 'warning')
      .map(m => m.message),
  };
}

/**
 * Wrap HTML content in a full document structure suitable for rendering in an iframe.
 */
export function wrapDocxHtml(html: string, fileName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Calibri, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 40px 48px;
      max-width: 100%;
      background: #fff;
    }
    h1 { font-size: 24px; margin: 16px 0 8px; }
    h2 { font-size: 20px; margin: 14px 0 6px; }
    h3 { font-size: 17px; margin: 12px 0 4px; }
    p { margin: 8px 0; }
    ul, ol { padding-left: 24px; margin: 8px 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 6px 10px;
      text-align: left;
    }
    th { background: #f5f5f5; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    blockquote {
      border-left: 3px solid #3b82f6;
      padding-left: 16px;
      margin: 12px 0;
      color: #555;
    }
  </style>
</head>
<body>${html}</body>
</html>`;
}
