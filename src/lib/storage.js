/**
 * Supabase Storage utilities for image uploads.
 *
 * Uploads images to the `diary-images` public bucket.
 * Falls back to base64 data URL if Supabase is not configured or upload fails.
 */
import { supabase, isConfigured } from './supabase';

const BUCKET = 'diary-images';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Upload an image file to Supabase Storage and return its public URL.
 *
 * @param {File} file — image file to upload
 * @returns {Promise<string>} — public URL or base64 data URL as fallback
 */
export async function uploadImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('图片过大，请选择 5MB 以内的图片');
  }

  // Fallback: if Supabase is not configured, use base64
  if (!isConfigured()) {
    return readFileAsDataURL(file);
  }

  try {
    // Generate a unique path: diary-images/1720000000_a1b2c3.png
    const ext = file.name.split('.').pop() || 'png';
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const path = `${unique}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '31536000', // 1 year — images are immutable
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('[Notebook] Supabase upload failed, falling back to base64:', err.message);
    return readFileAsDataURL(file);
  }
}

/**
 * Read a File as base64 data URL (fallback when Supabase is unavailable).
 */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
