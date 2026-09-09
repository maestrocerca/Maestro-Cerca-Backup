import React, { useState } from 'react';
import { 
  User, 
  Briefcase, 
  MapPin, 
  ImageIcon, 
  ShieldCheck, 
  Award, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Upload, 
  MessageCircle, 
  Phone, 
  Eye, 
  Clock, 
  Sparkles,
  Save,
  Camera,
  Mail,
  Send,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { WorkPhoto } from '../types';
import { 
  uploadWorkerProfileImage, 
  uploadWorkerWorkPhoto, 
  uploadVerificationDocument, 
  validateImageFile,
  validateVerificationDoc 
} from '../lib/storage';

export const WorkerDashboardView: React.FC = () => {
  const { 
    currentWorker, 
    firebaseUser,
    updateWorkerProfile, 
    submitVerificationRequest, 
    addWorkerPhoto, 
    removeWorkerPhoto, 
    calculateProfileCompletion, 
    trades, 
    serviceAreas, 
    navigateTo,
    contactEvents 
  } = useStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'services' | 'photos' | 'verification' | 'stats'>('profile');

  // Local Form state for editing
  const [formData, setFormData] = useState({
    firstName: currentWorker?.firstName || '',
    lastName: currentWorker?.lastName || '',
    email: currentWorker?.email || '',
    phone: currentWorker?.phone || '',
    whatsapp: currentWorker?.whatsapp || '',
    mainTrade: currentWorker?.mainTrade || '',
    secondaryTrades: currentWorker?.secondaryTrades || [],
    description: currentWorker?.description || '',
    yearsExperience: currentWorker?.yearsExperience || 5,
    services: currentWorker?.services || [],
    serviceAreas: currentWorker?.serviceAreas || [],
    profilePhoto: currentWorker?.profilePhoto || '',
  });

  const [newService, setNewService] = useState('');
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);

  // Verification request form state
  const [verifDocFile, setVerifDocFile] = useState<File | null>(null);
  const [verifDocName, setVerifDocName] = useState('INE_anverso_reverso.pdf');
  const [verifReferences, setVerifReferences] = useState('Ing. Salvador Vega (Obra Juriquilla) - 4421998877\nArq. Mariana Morales (Condominio Zibatá) - 4425556611');
  const [verifNotes, setVerifNotes] = useState('Cuento con experiencia comprobable y referencias vigentes en Querétaro.');
  const [verifSubmitted, setVerifSubmitted] = useState(false);
  const [isSubmittingVerif, setIsSubmittingVerif] = useState(false);

  // Sync formData whenever currentWorker updates from Firestore
  React.useEffect(() => {
    if (currentWorker) {
      setFormData({
        firstName: currentWorker.firstName || '',
        lastName: currentWorker.lastName || '',
        email: currentWorker.email || '',
        phone: currentWorker.phone || '',
        whatsapp: currentWorker.whatsapp || '',
        mainTrade: currentWorker.mainTrade || '',
        secondaryTrades: currentWorker.secondaryTrades || [],
        description: currentWorker.description || '',
        yearsExperience: currentWorker.yearsExperience || 5,
        services: currentWorker.services || [],
        serviceAreas: currentWorker.serviceAreas || [],
        profilePhoto: currentWorker.profilePhoto || '',
      });
    }
  }, [currentWorker?.id, currentWorker?.updatedAt]);

  if (!currentWorker || !firebaseUser) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAFA] py-16 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xs text-center space-y-5">
          <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto">
            <User className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Acceso protegido</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Debes iniciar sesión con tu cuenta de trabajador de Firebase Authentication para acceder a tu panel de control.
            </p>
          </div>
          <button
            onClick={() => navigateTo({ type: 'login' })}
            className="w-full py-3.5 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const completionScore = calculateProfileCompletion(currentWorker);
  const isVerified = currentWorker.verificationStatus === 'verified';

  // Metrics for this worker
  const workerEvents = contactEvents.filter((e) => e.workerId === currentWorker.id);
  const whatsappCount = workerEvents.filter((e) => e.type === 'whatsapp').length;
  const phoneCount = workerEvents.filter((e) => e.type === 'phone').length;
  const viewCount = workerEvents.filter((e) => e.type === 'profileView').length;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    try {
      const res = await updateWorkerProfile(currentWorker.id, {
        ...formData,
        yearsExperience: Number(formData.yearsExperience),
      });
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setSaveError(res.error || 'No se pudieron guardar los cambios en Firestore.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const check = validateImageFile(file, 5);
    if (!check.valid) {
      setSaveError(check.error || 'Archivo inválido');
      return;
    }

    setIsUploadingProfilePhoto(true);
    setSaveError('');
    try {
      const downloadUrl = await uploadWorkerProfileImage(currentWorker.userId || currentWorker.id, file);
      setFormData((prev) => ({ ...prev, profilePhoto: downloadUrl }));
      await updateWorkerProfile(currentWorker.id, { profilePhoto: downloadUrl });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('Profile photo upload error:', err);
      setSaveError(err?.message || 'Error al subir foto de perfil a Firebase Storage.');
    } finally {
      setIsUploadingProfilePhoto(false);
    }
  };

  const handleAddWorkPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const check = validateImageFile(file, 5);
    if (!check.valid) {
      setSaveError(check.error || 'Archivo inválido');
      return;
    }

    setIsUploadingPhoto(true);
    setSaveError('');
    try {
      const uploaded = await uploadWorkerWorkPhoto(
        currentWorker.userId || currentWorker.id, 
        file, 
        newPhotoTitle
      );
      await addWorkerPhoto(currentWorker.id, {
        url: uploaded.url,
        title: uploaded.title,
      });
      setNewPhotoTitle('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('Work photo upload error:', err);
      setSaveError(err?.message || 'Error al subir la fotografía de trabajo a Firebase Storage.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddServiceItem = () => {
    if (newService.trim()) {
      const updated = [...formData.services, newService.trim()];
      setFormData({ ...formData, services: updated });
      updateWorkerProfile(currentWorker.id, { services: updated });
      setNewService('');
    }
  };

  const handleRemoveServiceItem = (idx: number) => {
    const updated = formData.services.filter((_, i) => i !== idx);
    setFormData({ ...formData, services: updated });
    updateWorkerProfile(currentWorker.id, { services: updated });
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingVerif(true);
    setSaveError('');
    try {
      let finalDocPath = verifDocName;
      if (verifDocFile && firebaseUser) {
        const uploadRes = await uploadVerificationDocument(firebaseUser.uid, verifDocFile, 'ine');
        finalDocPath = uploadRes.storagePath;
      }

      const res = await submitVerificationRequest(currentWorker.id, {
        documents: [finalDocPath],
        references: [verifReferences],
        notes: verifNotes,
      });

      if (res.success) {
        setVerifSubmitted(true);
      } else {
        setSaveError(res.error || 'No se pudo enviar la solicitud.');
      }
    } catch (err: any) {
      console.error('Verification submission error:', err);
      setSaveError(err?.message || 'Error al procesar los documentos de verificación.');
    } finally {
      setIsSubmittingVerif(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Profile Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-200 shrink-0">
                <img
                  src={formData.profilePhoto || currentWorker.profilePhoto}
                  alt={currentWorker.firstName}
                  className="w-full h-full object-cover"
                />
              </div>
              <label className="absolute -bottom-1 -right-1 p-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-xs cursor-pointer transition-transform hover:scale-105">
                <Camera className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  disabled={isUploadingProfilePhoto}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {currentWorker.firstName} {currentWorker.lastName}
                </h1>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    <span>Verificado por Maestro Cerca</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <span>Registrado</span>
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-orange-600">{currentWorker.mainTrade}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentWorker.serviceAreas.join(', ')}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigateTo({ type: 'profile', workerSlug: currentWorker.slug })}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Ver perfil público</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {saveSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <span>Los cambios han sido guardados exitosamente en Firestore.</span>
          </div>
        )}
        {saveError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Completion Bar */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-700">Completitud de tu perfil</span>
            <span className="text-orange-600">{completionScore}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionScore >= 80 ? 'bg-green-500' : completionScore >= 50 ? 'bg-orange-500' : 'bg-amber-400'
              }`}
              style={{ width: `${completionScore}%` }}
            />
          </div>
          {completionScore < 100 && (
            <p className="text-[11px] text-slate-500">
              💡 Tip: Agrega más fotografías de tus trabajos y describe detalladamente tus servicios para alcanzar el 100%.
            </p>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Mi perfil
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'services'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Servicios ({formData.services.length})
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Galería de fotos ({currentWorker.workPhotos?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'verification'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span>Verificación</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Estadísticas
          </button>
        </div>

        {/* TAB 1: MI PERFIL */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Información básica del trabajador</h2>
                <p className="text-xs text-slate-500">Mantén tus datos actualizados para que los clientes puedan llamarte.</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Apellidos</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-slate-700">Teléfono celular</label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Autenticado por SMS</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Número principal con el que inicias sesión y recibes llamadas.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Número al que los clientes enviarán mensajes de WhatsApp.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Correo electrónico <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com (opcional)"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Opcional. Para recibir notificaciones o avisos administrativos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Oficio principal</label>
                  <select
                    value={formData.mainTrade}
                    onChange={(e) => setFormData({ ...formData, mainTrade: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                  >
                    {trades.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Años de experiencia</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.yearsExperience}
                    onChange={(e) => setFormData({ ...formData, yearsExperience: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Descripción pública</label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                />
              </div>

              {/* Zonas selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-2">Zonas de trabajo activas</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {serviceAreas.map((area) => {
                    const isChecked = formData.serviceAreas.includes(area.name);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          const updated = isChecked
                            ? formData.serviceAreas.filter((a) => a !== area.name)
                            : [...formData.serviceAreas, area.name];
                          setFormData({ ...formData, serviceAreas: updated });
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                          isChecked ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isChecked ? `✓ ${area.name}` : `+ ${area.name}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando en Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar cambios</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: MIS SERVICIOS */}
        {activeTab === 'services' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Servicios específicos que realizas</h2>
              <p className="text-xs text-slate-500">Agrega o elimina los tipos de trabajos que los clientes pueden solicitarte.</p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej. Reparación de fugas, Instalación de calentador..."
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddServiceItem();
                  }
                }}
                className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
              />
              <button
                type="button"
                onClick={handleAddServiceItem}
                className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-black flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {formData.services.map((srv, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-sm text-slate-800"
                >
                  <span className="font-medium">{srv}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveServiceItem(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: GALERÍA DE TRABAJOS (FIREBASE STORAGE UPLOADER) */}
        {activeTab === 'photos' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Fotografías de trabajos realizados</h2>
              <p className="text-xs text-slate-500">Sube fotos de tus proyectos para almacenar de forma segura en Firebase Storage.</p>
            </div>

            {/* Upload form to Firebase Storage */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <p className="text-xs font-bold uppercase text-slate-700">Subir nueva fotografía a tu portafolio:</p>

              <p className="text-[11px] text-slate-500 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200">
                Al subir fotografías confirmas que cuentas con autorización para compartirlas y que procurarás no incluir documentos, teléfonos, domicilios u otros datos personales de terceros.
              </p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Título breve del trabajo (ej. Instalación de cocina integral)"
                  value={newPhotoTitle}
                  onChange={(e) => setNewPhotoTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                />

                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Seleccionar imagen y subir</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingPhoto}
                      onChange={handleAddWorkPhotoFile}
                      className="hidden"
                    />
                  </label>
                  {isUploadingPhoto && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                      <span>Subiendo a Firebase Storage...</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Límite de 5MB por imagen. Formatos soportados: JPG, PNG, WebP.</p>
              </div>
            </div>

            {/* Current Photos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {currentWorker.workPhotos?.map((photo) => (
                <div key={photo.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-4/3">
                  <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between text-white">
                    <p className="text-xs font-bold">{photo.title}</p>
                    <button
                      type="button"
                      onClick={() => removeWorkerPhoto(currentWorker.id, photo.id)}
                      className="self-end p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: VERIFICACIÓN */}
        {activeTab === 'verification' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Verifica tu perfil en Maestro Cerca
                </h2>
                <p className="text-slate-600 text-sm mt-0.5">
                  Los perfiles verificados aparecen primero en las búsquedas y generan mayor confianza en los clientes de Querétaro.
                </p>
              </div>
            </div>

            {isVerified ? (
              <div className="p-5 rounded-2xl bg-green-50 border border-green-200 text-green-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-green-700" />
                  <span>Tu perfil ya está Verificado por Maestro Cerca</span>
                </div>
                <p className="text-xs text-green-800">
                  Tus documentos, referencias y fotografías han sido aprobados manualmente por el equipo de administración.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Status card */}
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs leading-relaxed space-y-1">
                  <p className="font-bold">Estatus actual: Registrado en Maestro Cerca</p>
                  <p>
                    Para obtener el distintivo <strong>"Verificado por Maestro Cerca"</strong>, envía tu información para que el equipo administrativo la revise de manera segura.
                  </p>
                </div>

                {verifSubmitted || currentWorker.verificationRequest ? (
                  <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 space-y-2">
                    <p className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span>Solicitud de verificación en revisión</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Hemos recibido tus referencias y documentos. El equipo de administración revisará la información para verificar tu identidad y antecedentes.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleVerificationSubmit} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        1. Identificación oficial (INE o pasaporte)
                      </label>
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const check = validateVerificationDoc(file, 10);
                              if (!check.valid) {
                                alert(check.error);
                                return;
                              }
                              setVerifDocFile(file);
                              setVerifDocName(file.name);
                            }
                          }}
                          className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-black cursor-pointer"
                        />
                        {verifDocFile && (
                          <div className="text-xs text-emerald-600 font-medium">
                            Archivo adjunto: {verifDocFile.name} ({(verifDocFile.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500">
                          Se guarda de forma privada y encriptada en Firebase Storage (solo visible para auditores y administradores).
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        2. Referencias de clientes o arquitectos en Querétaro
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={verifReferences}
                        onChange={(e) => setVerifReferences(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Incluye nombre y teléfono de 2 personas que recomienden tu trabajo.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        3. Notas adicionales para el revisor
                      </label>
                      <input
                        type="text"
                        value={verifNotes}
                        onChange={(e) => setVerifNotes(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingVerif}
                        className="w-full sm:w-auto py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        {isSubmittingVerif ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Enviando documentos a almacenamiento seguro...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Enviar solicitud de verificación</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

              </div>
            )}

          </div>
        )}

        {/* TAB 5: ESTADÍSTICAS */}
        {activeTab === 'stats' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Métricas de contacto directo</h2>
              <p className="text-xs text-slate-500">Monitorea cuántos clientes han visto tu perfil y te han contactado.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>Clics en WhatsApp</span>
                </div>
                <p className="text-3xl font-black text-emerald-950">{whatsappCount}</p>
                <p className="text-[11px] text-emerald-700 mt-1">Clientes que abrieron conversación directa</p>
              </div>

              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200">
                <div className="flex items-center gap-2 text-blue-800 font-bold text-xs mb-1">
                  <Phone className="w-4 h-4" />
                  <span>Clics en Llamar</span>
                </div>
                <p className="text-3xl font-black text-blue-950">{phoneCount}</p>
                <p className="text-[11px] text-blue-700 mt-1">Llamadas directas iniciadas</p>
              </div>

              <div className="p-5 rounded-2xl bg-purple-50/60 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-800 font-bold text-xs mb-1">
                  <Eye className="w-4 h-4" />
                  <span>Vistas de perfil</span>
                </div>
                <p className="text-3xl font-black text-purple-950">{viewCount}</p>
                <p className="text-[11px] text-purple-700 mt-1">Veces que se ha consultado tu ficha</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
