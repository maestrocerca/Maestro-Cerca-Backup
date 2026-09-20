import { ref, uploadBytesResumable, getDownloadURL, getBlob, listAll } from 'firebase/storage';
import { auth, storage } from './firebase';

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Ensures an active authenticated session exists before Storage writes.
 * Reuses the existing authenticated user's session (e.g. from Firebase Phone Auth).
 * Does NOT generate insecure temp_* IDs and does NOT force anonymous authentication.
 */
export const ensureAuthenticatedSession = async (providedUid?: string): Promise<string> => {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  if (providedUid && !providedUid.startsWith('temp_')) {
    return providedUid;
  }
  throw new Error('Debes tener una sesión activa para subir archivos.');
};

/**
 * Validates file format and size limits according to security policies:
 * - Images only (image/jpeg, image/png, image/webp)
 * - Maximum 5MB per file
 */
export const validateImageFile = (file: File, maxMb = 5): UploadValidationResult => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const mime = (file.type || '').toLowerCase();
  const isAllowedMime = allowedTypes.includes(mime);
  const isAllowedExt = /\.(jpe?g|png|webp)$/i.test(file.name);

  if (!isAllowedMime && !isAllowedExt) {
    return { 
      valid: false, 
      error: 'Formato de archivo no válido. Solo se permiten imágenes JPEG, PNG o WebP.' 
    };
  }
  if (file.size > maxMb * 1024 * 1024) {
    return { 
      valid: false, 
      error: `La imagen excede el tamaño máximo permitido de ${maxMb}MB.` 
    };
  }
  return { valid: true };
};

/**
 * Validates verification document (INE, proof of address):
 * - JPG, PNG or PDF
 * - Maximum 10MB per file
 */
export const validateVerificationDoc = (file: File, maxMb = 10): UploadValidationResult => {
  const isImage = file.type && file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  if (!isImage && !isPdf) {
    return {
      valid: false,
      error: 'Formato no permitido. Solo se aceptan fotos legibles o archivos PDF (INE o comprobante de domicilio).',
    };
  }
  if (file.size > maxMb * 1024 * 1024) {
    return {
      valid: false,
      error: `El documento excede el tamaño máximo permitido de ${maxMb}MB.`,
    };
  }
  return { valid: true };
};

/**
 * Downscales and re-compresses a photo client-side before upload. Phone camera
 * photos routinely come in at 8-15MB / 4000px+ wide, which is fine for local
 * viewing but painfully slow to upload over mobile data — this brings that
 * down to a web-appropriate size first. Fails open (returns the original file
 * untouched) on any decode/canvas error, so a compression hiccup never blocks
 * an otherwise-valid upload.
 */
export const compressImage = (file: File, maxDimension = 1600, quality = 0.82): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;

      // Already small enough — don't bother re-encoding (and risk quality loss for nothing).
      if (width <= maxDimension && height <= maxDimension && file.size <= 800 * 1024) {
        resolve(file);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetWidth = Math.round(width * scale);
      const targetHeight = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const outputName = outputType === 'image/jpeg' ? file.name.replace(/\.[^/.]+$/, '.jpg') : file.name;
          const compressed = new File([blob], outputName, { type: outputType, lastModified: Date.now() });
          resolve(compressed.size < file.size ? compressed : file);
        },
        outputType,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
};

/**
 * Upload helper using uploadBytesResumable to ensure resilient uploads on mobile connections.
 */
const uploadWithResumable = (
  storageRef: any,
  file: File,
  metadata?: any,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(progress);
        }
      },
      (error) => {
        console.error('[Storage Task Error]:', error?.code, error?.message);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (urlErr) {
          reject(urlErr);
        }
      }
    );
  });
};

/**
 * Uploads worker profile photo to Firebase Storage under private pending path:
 * /profile-photos-pending/{uid}/avatar_{timestamp}.{ext}
 * 
 * IMPORTANT: Strictly avoids generating a public download URL!
 * Returns the storagePath so it can be stored privately in Firestore until administrative review.
 */
export const uploadWorkerProfileImage = async (
  userId: string | undefined,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ storagePath: string; fileName: string }> => {
  const check = validateImageFile(file, 5);
  if (!check.valid) {
    throw new Error(check.error || 'Archivo de imagen inválido.');
  }

  const effectiveUid = await ensureAuthenticatedSession(userId);
  const uploadFile = await compressImage(file);

  const rawExt = (uploadFile.name.split('.').pop() || 'jpg').toLowerCase();
  const ext = rawExt === 'jpeg' || rawExt === 'jpg' ? 'jpg' : rawExt === 'png' ? 'png' : 'webp';
  const fileName = `avatar_${Date.now()}.${ext}`;
  const storagePath = `profile-photos-pending/${effectiveUid}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const uploadTask = uploadBytesResumable(
      storageRef,
      uploadFile,
      {
        contentType: uploadFile.type || (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`),
        customMetadata: {
          uploadedBy: effectiveUid,
          type: 'pendingProfilePhoto',
          uploadedAt: new Date().toISOString(),
        },
      }
    );

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.round(progress));
          }
        },
        (error) => reject(error),
        () => resolve()
      );
    });

    return { storagePath, fileName };
  } catch (err: any) {
    console.error('[Storage Error - Pending Profile Photo]:', err?.code || 'upload_pending_profile_photo_failed', err?.message || err);
    throw new Error('No pudimos subir esta fotografía. Intenta nuevamente.');
  }
};

/**
 * Retrieves a transient, in-memory object URL for an authenticated owner or admin
 * to preview a pending profile photo without creating a persistent public download URL.
 */
export const getPendingPhotoPreviewUrl = async (storagePath: string): Promise<string | null> => {
  if (!storagePath) return null;
  try {
    const storageRef = ref(storage, storagePath);
    // getBlob uses authenticated Firebase Storage SDK request (subject to storage.rules)
    const blob = await getBlob(storageRef);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Could not fetch pending photo preview blob:', err);
    return null;
  }
};

/**
 * Uploads worker gallery work photo to Firebase Storage under path:
 * /portafolios/{uid}/work_{timestamp}_{index}.{ext}
 */
export const uploadWorkerWorkPhoto = async (
  userId: string | undefined,
  file: File,
  caption?: string,
  index?: number,
  onProgress?: (progress: number) => void
): Promise<{ url: string; title: string }> => {
  const check = validateImageFile(file, 5);
  if (!check.valid) {
    throw new Error(check.error || 'Archivo de imagen inválido.');
  }

  const effectiveUid = await ensureAuthenticatedSession(userId);
  const uploadFile = await compressImage(file);

  const rawExt = (uploadFile.name.split('.').pop() || 'jpg').toLowerCase();
  const ext = rawExt === 'jpeg' || rawExt === 'jpg' ? 'jpg' : rawExt === 'png' ? 'png' : 'webp';
  const idx = index !== undefined ? `${index}` : Math.random().toString(36).substring(2, 6);
  const fileName = `work_${Date.now()}_${idx}.${ext}`;
  const storageRef = ref(storage, `portafolios/${effectiveUid}/${fileName}`);

  try {
    const downloadUrl = await uploadWithResumable(
      storageRef,
      uploadFile,
      {
        contentType: uploadFile.type || (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`),
        customMetadata: {
          uploadedBy: effectiveUid,
          type: 'workGallery',
          uploadedAt: new Date().toISOString(),
        },
      },
      onProgress
    );
    const cleanTitle = caption?.trim() || file.name.replace(/\.[^/.]+$/, '');
    return { url: downloadUrl, title: cleanTitle };
  } catch (err: any) {
    console.error('[Storage Error]:', err?.code || 'upload_work_photo_failed', err?.message || err);
    throw new Error('No pudimos subir esta fotografía. Intenta nuevamente.');
  }
};

/**
 * Uploads private identification/verification documents (INE, proof of address)
 * to private path /verificaciones/{uid}/
 * Only the owner and administrators can read these files according to storage.rules.
 */
export const uploadVerificationDocument = async (
  userId: string,
  file: File,
  docType: 'ine' | 'comprobante_domicilio' | 'referencias' | 'comprobante' | 'certificado' | string = 'comprobante',
  onProgress?: (progress: number) => void
): Promise<{ storagePath: string; fileName: string }> => {
  const check = validateVerificationDoc(file, 10);
  if (!check.valid) {
    throw new Error(check.error || 'Documento no válido.');
  }

  const effectiveUid = await ensureAuthenticatedSession(userId);

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeDocType = docType.replace(/[^a-z0-9_]/g, '');
  const fileName = `${safeDocType}_${Date.now()}.${extension}`;
  const fullPath = `verificaciones/${effectiveUid}/${fileName}`;
  const storageRef = ref(storage, fullPath);

  try {
    await uploadWithResumable(
      storageRef,
      file,
      {
        contentType: file.type,
        customMetadata: {
          uploadedBy: effectiveUid,
          docType: safeDocType,
          uploadedAt: new Date().toISOString(),
          isPrivate: 'true',
        },
      },
      onProgress
    );
    return { storagePath: fullPath, fileName };
  } catch (err: any) {
    console.error('[Storage Error]:', err?.code || 'upload_doc_failed', err?.message || err);
    throw new Error('No se pudo subir el documento. Verifica tu conexión e intenta de nuevo.');
  }
};

/**
 * Retrieves sensitive verification documents (INE, proof of address) securely
 * using authenticated Firebase Storage operations without generating persistent public download URLs.
 * Creates an ephemeral, in-memory Blob URL for authorized admin viewing that is revoked when closed.
 */
export const getSecureTransientBlobUrl = async (
  storagePath: string
): Promise<{ blobUrl: string; contentType: string; revoke: () => void }> => {
  const storageRef = ref(storage, storagePath);
  const blob = await getBlob(storageRef);
  const blobUrl = URL.createObjectURL(blob);
  return {
    blobUrl,
    contentType: blob.type,
    revoke: () => {
      URL.revokeObjectURL(blobUrl);
    },
  };
};

/**
 * Lists all verification files uploaded under a worker's private directory
 * Path: /verificaciones/{userId}/
 */
export const listWorkerVerificationDocs = async (
  userId: string
): Promise<string[]> => {
  try {
    const folderRef = ref(storage, `verificaciones/${userId}`);
    const res = await listAll(folderRef);
    return res.items.map((itemRef) => itemRef.fullPath);
  } catch (err) {
    console.warn('Listing verification docs note:', err);
    return [];
  }
};
