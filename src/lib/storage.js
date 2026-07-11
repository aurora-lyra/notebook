/**
 * Supabase Storage utilities for image uploads.
 *
 * Compresses images locally before uploading to `diary-images` bucket.
 * Target: max 1200px wide, ~150-200KB, WebP format (JPEG fallback).
 */
import imageCompression from 'browser-image-compression';
import { supabase, isConfigured } from './supabase';

const BUCKET = 'diary-images';
const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10 MB (pre-compression limit)

// Compression targets
const COMPRESS_OPTIONS = {
  maxSizeMB: 0.2,            // ~200KB target
  maxWidthOrHeight: 1200,    // max 1200px on longest side
  useWebWorker: true,        // non-blocking compression
  initialQuality: 0.8,       // JPEG/WEBP quality starting point
};

/**
 * Compress an image file locally before upload.
 * Tries WebP first, falls back to JPEG for older browsers.
 */
async function compressImage(file) {
  // Check if browser supports WebP via canvas
  const supportsWebP = (() => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch {
      return false;
    }
  })();

  const options = { ...COMPRESS_OPTIONS };

  // Try WebP, fall back to JPEG
  if (supportsWebP) {
    options.fileType = 'image/webp';
  } else {
    options.fileType = 'image/jpeg';
  }

  try {
    const compressed = await imageCompression(file, options);

    // If compression didn't reduce size, try with lower quality
    if (compressed.size >= file.size * 0.9 && file.size > 200 * 1024) {
      const aggressive = await imageCompression(file, {
        ...options,
        initialQuality: 0.6,
        maxSizeMB: 0.15,
      });
      return aggressive;
    }

    return compressed;
  } catch (err) {
    console.warn('[Notebook] Image compression failed, using original:', err.message);
    return file;
  }
}

/**
 * Upload an image file to Supabase Storage and return its public URL.
 * Compresses the image before uploading.
 *
 * @param {File} file — image file to upload
 * @returns {Promise<string>} — public URL or base64 data URL as fallback
 */
export async function uploadImage(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error('图片过大，请选择 10MB 以内的图片');
  }

  // Compress before upload
  const compressed = await compressImage(file);

  // Determine file extension from the compressed blob type
  const ext = compressed.type === 'image/webp' ? 'webp'
    : compressed.type === 'image/jpeg' ? 'jpg'
    : 'png';

  // Fallback: if Supabase is not configured, use base64
  if (!isConfigured()) {
    return readFileAsDataURL(compressed);
  }

  try {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const path = `${unique}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, compressed, {
        cacheControl: '31536000', // 1 year — images are immutable
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('[Notebook] Supabase upload failed, falling back to base64:', err.message);
    return readFileAsDataURL(compressed);
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
