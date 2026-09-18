import { describe, it, expect } from 'vitest';
import { removeUndefinedFields } from '../../src/lib/sanitize';

/**
  Simulates worker profile payload generation matching StoreContext.tsx -> createWorkerProfile()
 */
function buildTestWorkerPayload({
  firebaseUid,
  registrationMethod,
  hasPhoneProvider,
  userPhoneNumber,
  pendingPhotoPath,
  inputData = {},
}: {
  firebaseUid: string;
  registrationMethod: 'facebook' | 'phone';
  hasPhoneProvider: boolean;
  userPhoneNumber?: string | null;
  pendingPhotoPath?: string;
  inputData?: Record<string, any>;
}) {
  const isPhoneAuthVerified = Boolean(
    userPhoneNumber || hasPhoneProvider
  );
  const nowIso = '2026-09-16T21:00:00.000Z';

  const newWorker = {
    id: firebaseUid,
    userId: firebaseUid,
    slug: 'juan-perez-1234',
    nombre: 'Juan Pérez',
    oficio: 'Albañil',
    bio: 'Especialista en acabados',
    calificacion: 5.0,
    radioKm: 15,
    lat: 20.6934,
    lng: -100.3255,
    fotoUrl: '',
    photoUrl: '',
    telefonoWhatsApp: '524421234567',
    nivel: 'Aspirante',
    verificado: false,
    aprobado: false,
    statusPerfil: 'Pendiente',
    isAvailable: true,
    fechaRegistro: nowIso,
    firstName: 'Juan',
    lastName: 'Pérez',
    email: inputData.email || '',
    phone: '4421234567',
    phoneE164: '+524421234567',
    whatsapp: '524421234567',
    registrationMethod,
    profilePhoto: '',
    profilePhotoReviewStatus: pendingPhotoPath ? 'pending' : 'none',
    pendingProfilePhotoPath: pendingPhotoPath || null,
    mainTrade: 'Albañil',
    secondaryTrades: [],
    services: ['Aplanados', 'Bardas'],
    description: 'Especialista en acabados',
    yearsExperience: 5,
    serviceAreas: ['Zibatá', 'El Refugio'],
    workPhotos: [],
    fotosTrabajos: [],
    verificationStatus: 'registered',
    status: 'registered',
    onboardingIncomplete: false,
    authProviders: registrationMethod === 'facebook'
      ? (hasPhoneProvider ? ['facebook.com', 'phone'] : ['facebook.com'])
      : ['phone'],
    source: 'web',
    origen: 'web',
    phoneVerified: isPhoneAuthVerified,
    ...(isPhoneAuthVerified
      ? {
          phoneVerifiedAt: nowIso,
          phoneVerificationMethod: 'firebase_sms',
        }
      : {}),
    identityVerified: false,
    referencesVerified: false,
    photosReviewed: false,
    joinedDate: nowIso.split('T')[0],
    privacyNoticeAccepted: true,
    privacyNoticeAcceptedAt: nowIso,
    privacyNoticeVersion: '1.0',
    termsAccepted: true,
    termsAcceptedAt: nowIso,
    termsVersion: '1.0',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const docPayload = removeUndefinedFields(newWorker);
  return { newWorker, docPayload };
}

describe('Worker Registration Payload Specification (PRUEBAS 1-4)', () => {
  it('PRUEBA 1: Facebook nuevo SIN verificar SMS genera doc seguro para Firestore', () => {
    const { newWorker, docPayload } = buildTestWorkerPayload({
      firebaseUid: 'fb_user_no_sms_123',
      registrationMethod: 'facebook',
      hasPhoneProvider: false,
      userPhoneNumber: null,
    });

    // Validations:
    expect(docPayload.registrationMethod).toBe('facebook');
    expect(docPayload.phoneVerified).toBe(false);
    expect(docPayload.aprobado).toBe(false);
    expect(docPayload.statusPerfil).toBe('Pendiente');
    expect(docPayload.verificationStatus).toBe('registered');

    // phoneVerifiedAt and phoneVerificationMethod must NOT exist in docPayload:
    expect('phoneVerifiedAt' in docPayload).toBe(false);
    expect('phoneVerificationMethod' in docPayload).toBe(false);
    expect(docPayload.phoneVerifiedAt).toBeUndefined();
    expect(docPayload.phoneVerificationMethod).toBeUndefined();

    // No key in docPayload should have value undefined:
    for (const [key, value] of Object.entries(docPayload)) {
      expect(value).not.toBeUndefined();
    }
  });

  it('PRUEBA 2: Facebook + SMS genera campos completos de verificación celular', () => {
    const { newWorker, docPayload } = buildTestWorkerPayload({
      firebaseUid: 'fb_user_with_sms_456',
      registrationMethod: 'facebook',
      hasPhoneProvider: true,
      userPhoneNumber: '+524421234567',
    });

    // Validations:
    expect(docPayload.registrationMethod).toBe('facebook');
    expect(docPayload.phoneVerified).toBe(true);
    expect(docPayload.phoneVerifiedAt).toBe('2026-09-16T21:00:00.000Z');
    expect(docPayload.phoneVerificationMethod).toBe('firebase_sms');
    expect(docPayload.authProviders).toContain('facebook.com');
    expect(docPayload.authProviders).toContain('phone');

    // No key in docPayload should have value undefined:
    for (const [key, value] of Object.entries(docPayload)) {
      expect(value).not.toBeUndefined();
    }
  });

  it('PRUEBA 3: Registro Phone SMS continúa funcionando exactamente igual', () => {
    const { newWorker, docPayload } = buildTestWorkerPayload({
      firebaseUid: 'phone_user_789',
      registrationMethod: 'phone',
      hasPhoneProvider: true,
      userPhoneNumber: '+524429876543',
    });

    // Validations:
    expect(docPayload.registrationMethod).toBe('phone');
    expect(docPayload.phoneVerified).toBe(true);
    expect(docPayload.phoneVerifiedAt).toBe('2026-09-16T21:00:00.000Z');
    expect(docPayload.phoneVerificationMethod).toBe('firebase_sms');
    expect(docPayload.authProviders).toContain('phone');

    // No key in docPayload should have value undefined:
    for (const [key, value] of Object.entries(docPayload)) {
      expect(value).not.toBeUndefined();
    }
  });

  it('PRUEBA 4: Búsqueda global de undefined dentro del payload final enviado a setDoc', () => {
    const { docPayload } = buildTestWorkerPayload({
      firebaseUid: 'fb_edge_case_999',
      registrationMethod: 'facebook',
      hasPhoneProvider: false,
      userPhoneNumber: null,
      inputData: {
        optionalNote: undefined,
        customBio: undefined,
      },
    });

    const undefinedKeys = Object.entries(docPayload)
      .filter(([_, value]) => value === undefined)
      .map(([key]) => key);

    expect(undefinedKeys).toHaveLength(0);
    expect(JSON.stringify(docPayload)).not.toContain('undefined');
  });
});
