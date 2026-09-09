import { ref, uploadBytes, getDownloadURL, getBlob, listAll } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file format and size limits according to security policies:
 * - Images only (image/*)
 * - Maximum 5MB per file
 */
export const validateImageFile = (file: File, maxMb = 5): UploadValidationResult => {
  if (!file.type || !file.type.startsWith('image/')) {
    return { 
      valid: false, 
      error: 'Formato de archivo no válido. Solo se permiten imágenes (JPG, PNG, WebP).' 
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
 * Uploads worker profile photo to Firebase Storage under public path:
 * /portafolios/{uid}/profile_{timestamp}.{ext}
 */
export const uploadWorkerProfileImage = async (
  userId: string,
  file: File
): Promise<string> => {
  if (!userId) {
    throw new Error('Se requiere un usuario autenticado para subir imágenes.');
  }

  const check = validateImageFile(file, 5);
  if (!check.valid) {
    throw new Error(check.error || 'Archivo de imagen inválido.');
  }

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `profile_${Date.now()}.${extension}`;
  // Public image path: /portafolios/{uid}/
  const storageRef = ref(storage, `portafolios/${userId}/${fileName}`);

  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedBy: userId,
      type: 'profilePhoto',
      uploadedAt: new Date().toISOString(),
    },
  });

  return await getDownloadURL(snapshot.ref);
};

/**
 * Uploads worker gallery work photo to Firebase Storage under public path:
 * /portafolios/{uid}/work_{timestamp}_{rand}.{ext}
 */
export const uploadWorkerWorkPhoto = async (
  userId: string,
  file: File,
  caption?: string
): Promise<{ url: string; title: string }> => {
  if (!userId) {
    throw new Error('Se requiere un usuario autenticado para subir imágenes.');
  }

  const check = validateImageFile(file, 5);
  if (!check.valid) {
    throw new Error(check.error || 'Archivo de imagen inválido.');
  }

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `work_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${extension}`;
  // Public portfolio path: /portafolios/{uid}/
  const storageRef = ref(storage, `portafolios/${userId}/${fileName}`);

  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedBy: userId,
      type: 'workGallery',
      uploadedAt: new Date().toISOString(),
    },
  });

  const url = await getDownloadURL(snapshot.ref);
  const cleanTitle = caption?.trim() || file.name.replace(/\.[^/.]+$/, '');

  return {
    url,
    title: cleanTitle,
  };
};

/**
 * Uploads private identification/verification documents (INE, proof of address)
 * to private path /verificaciones/{uid}/ to PREVENT public URL access!
 * Only the owner and administrators can read these files according to storage.rules.
 */
export const uploadVerificationDocument = async (
  userId: string,
  file: File,
  docType: 'ine' | 'comprobante_domicilio' | 'referencias'
): Promise<{ storagePath: string; fileName: string }> => {
  if (!userId) {
    throw new Error('Se requiere usuario autenticado para subir documentos de verificación.');
  }

  const check = validateVerificationDoc(file, 10);
  if (!check.valid) {
    throw new Error(check.error || 'Documento no válido.');
  }

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeDocType = docType.replace(/[^a-z0-9_]/g, '');
  const fileName = `${safeDocType}_${Date.now()}.${extension}`;
  // Private path: /verificaciones/{uid}/
  const fullPath = `verificaciones/${userId}/${fileName}`;
  const storageRef = ref(storage, fullPath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedBy: userId,
      docType: safeDocType,
      uploadedAt: new Date().toISOString(),
      isPrivate: 'true',
    },
  });

  return {
    storagePath: fullPath,
    fileName,
  };
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

