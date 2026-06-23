import { supabase, isSupabaseConfigured } from './supabase';

export interface DocumentRecord {
  id: string;
  user_id: string;
  original_filename: string;
  storage_path: string | null;
  page_count: number;
  signature_count: number;
  signed_at: string;
}

export async function saveDocumentRecord(
  userId: string,
  filename: string,
  pageCount: number,
  signatureCount: number,
  signedPdfBlob?: Blob,
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    let storagePath: string | null = null;

    if (signedPdfBlob) {
      const filePath = `${userId}/${Date.now()}-${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(filePath, signedPdfBlob, {
          contentType: 'application/pdf',
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
      } else {
        storagePath = filePath;
      }
    }

    const { error } = await supabase.from('documents').insert({
      user_id: userId,
      original_filename: filename,
      storage_path: storagePath,
      page_count: pageCount,
      signature_count: signatureCount,
    });

    return { error };
  } catch (error) {
    console.error('Save document error:', error);
    return { error: error instanceof Error ? error : new Error('Failed to save document') };
  }
}

export async function getDocumentHistory(userId: string): Promise<{ data: DocumentRecord[]; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('signed_at', { ascending: false });

  return { data: (data as DocumentRecord[]) ?? [], error };
}

export async function getDocumentDownloadUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { data } = await supabase.storage
    .from('signed-documents')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry

  return data?.signedUrl ?? null;
}

export async function deleteDocumentRecord(id: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase not configured') };
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);
  return { error };
}
