import { db } from './db.js';
import { ApiError } from './http.js';
import { randomUUID } from 'node:crypto';

export async function trimOwnerHistory(ownerId: string) {
  const client = db();
  const { data: conversations, error } = await client
    .from('conversations')
    .select('id,subject_code,updated_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) throw new ApiError(500, 'database_error', error.message);
  const rows = conversations || [];
  const keep = new Set<string>();
  const subjectCounts = new Map<string, number>();
  for (const row of rows) {
    const count = subjectCounts.get(row.subject_code) || 0;
    if (count < 50 && keep.size < 200) {
      keep.add(row.id);
      subjectCounts.set(row.subject_code, count + 1);
    }
  }
  const remove = rows.filter((row) => !keep.has(row.id)).map((row) => row.id);
  if (!remove.length) return;
  await removeConversationFiles(remove);
  const { error: deleteError } = await client.from('conversations').delete().in('id', remove);
  if (deleteError) throw new ApiError(500, 'database_error', deleteError.message);
}

export async function trimImages(ownerId: string) {
  const client = db();
  const { data: ownerRows } = await client.from('attachments').select('id,storage_path,created_at').eq('owner_id', ownerId).order('created_at', { ascending: false });
  const ownerRemove = (ownerRows || []).slice(20);
  const { data: globalRows, error: pruneError } = await client.rpc('attachments_over_limit', { p_max_count: 1000, p_max_bytes: 500 * 1024 * 1024 });
  if (pruneError) throw new ApiError(500, 'database_error', pruneError.message);
  const deduped = Array.from(new Map([...ownerRemove, ...(globalRows || [])].map((row) => [row.id, row])).values());
  if (!deduped.length) return;
  const { error: storageError } = await client.storage.from('chat-images').remove(deduped.map((row) => row.storage_path));
  if (storageError) throw new ApiError(500, 'storage_delete_failed', storageError.message);
  const { error: deleteError } = await client.from('attachments').delete().in('id', deduped.map((row) => row.id));
  if (deleteError) throw new ApiError(500, 'database_error', deleteError.message);
}

export async function removeConversationFiles(conversationIds: string[]) {
  const client = db();
  const { data } = await client.from('attachments').select('storage_path').in('conversation_id', conversationIds);
  const paths = (data || []).map((row) => row.storage_path);
  if (paths.length) {
    const { error } = await client.storage.from('chat-images').remove(paths);
    if (error) throw new ApiError(500, 'storage_delete_failed', error.message);
  }
}

export async function removeOwnerFiles(ownerId: string) {
  const client = db();
  const { data, error: queryError } = await client.from('attachments').select('storage_path').eq('owner_id', ownerId);
  if (queryError) throw new ApiError(500, 'database_error', queryError.message);
  const paths = (data || []).map((row) => row.storage_path);
  if (paths.length) {
    const { error } = await client.storage.from('chat-images').remove(paths);
    if (error) throw new ApiError(500, 'storage_delete_failed', error.message);
  }
}

export async function storeImage(ownerId: string, conversationId: string, imageData: string) {
  const match = imageData.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) throw new ApiError(400, 'invalid_image', '图片格式无效');
  const mimeType = match[1];
  const encoded = match[2];
  if (!mimeType || !encoded) throw new ApiError(400, 'invalid_image', '图片格式无效');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 500 * 1024) throw new ApiError(413, 'image_too_large', '压缩后的图片不能超过500KB');
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${ownerId}/${conversationId}/${randomUUID()}.${extension}`;
  const client = db();
  const { error } = await client.storage.from('chat-images').upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new ApiError(500, 'upload_failed', error.message);
  const { error: insertError } = await client.from('attachments').insert({ owner_id: ownerId, conversation_id: conversationId, storage_path: path, mime_type: mimeType, size_bytes: bytes.length });
  if (insertError) {
    await client.storage.from('chat-images').remove([path]);
    throw new ApiError(500, 'database_error', insertError.message);
  }
  await trimImages(ownerId);
}
