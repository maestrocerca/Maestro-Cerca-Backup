import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Phone, 
  MessageCircle, 
  Briefcase, 
  ImageIcon, 
  X, 
  ChevronRight, 
  AlertCircle,
  Share2,
  Award,
  Check,
  Calendar,
  Sparkles,
  User,
  Wrench,
  Flag,
  Users
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { WorkPhoto, isPubliclyVisible } from '../types';
import { WorkerAvatar } from './WorkerAvatar';

interface WorkerProfileViewProps {
  workerSlug: string;
}

export const WorkerProfileView: React.FC<WorkerProfileViewProps> = ({ workerSlug }) => {
  const { 
    getWorkerBySlug, 
    navigateTo, 
    logContactClick, 
    logProfileView, 
    contactarWhatsApp,
    isCatalogLoading,
    submitProfileReport,
    showToast,
    firebaseUser,
    isAdmin
  } = useStore();
  const worker = getWorkerBySlug(workerSlug);

  const [selectedPhoto, setSelectedPhoto] = useState<WorkPhoto | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Información o datos de contacto falsos');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    if (worker) {
      logProfileView(worker);
    }
  }, [worker, logProfileView]);

  if (!worker) {
    if (isCatalogLoading) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
          <div className="w-10 h-10 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 font-medium text-sm">Cargando perfil del maestro...</p>
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Trabajador no encontrado</h2>
        <p className="text-slate-600">El perfil que buscas no existe o ha sido desactivado.</p>
        <button
          onClick={() => navigateTo({ type: 'search' })}
          className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl"
        >
          Volver al directorio
        </button>
      </div>
    );
  }

  // Check public visibility & owner/admin authorization
  const isVisible = isPubliclyVisible(worker);
  const isOwner = Boolean(
    firebaseUser && (firebaseUser.uid === worker.id || firebaseUser.uid === worker.userId)
  );
  const isOwnerOrAdmin = isOwner || isAdmin;

  // Unapproved or private profiles are blocked for anonymous visitors and non-owners
  if (!isVisible && !isOwnerOrAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Perfil en revisión</h2>
        <p className="text-slate-600 max-w-md mx-auto">
          Este perfil está en revisión o no está disponible públicamente.
        </p>
        <button
          onClick={() => navigateTo({ type: 'search' })}
          className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors cursor-pointer"
        >
          Volver al directorio
        </button>
      </div>
    );
  }

  const isVerified = worker.verificationStatus === 'verified' || worker.verificado === true;
  const workPhotosList = (worker.workPhotos && worker.workPhotos.length > 0)
    ? worker.workPhotos
    : (worker.fotosTrabajos && worker.fotosTrabajos.length > 0)
      ? worker.fotosTrabajos.map((url, idx) => ({ id: `p-${idx}`, url, title: 'Trabajo realizado', description: '' }))
      : [];
  const mainArea = (worker.serviceAreas && worker.serviceAreas.length > 0 && worker.serviceAreas[0])
    ? worker.serviceAreas[0]
    : null;

  const handleWhatsApp = () => {
    contactarWhatsApp(worker);
  };

  const handlePhone = () => {
    logContactClick(worker, 'phone');
    window.location.href = `tel:${worker.phone}`;
  };

  const handleShare = async () => {
    const canonicalUrl = `${window.location.origin}/trabajador/${encodeURIComponent(worker.slug || worker.id)}`;
    const shareData = {
      title: `${worker.firstName} ${worker.lastName} - ${worker.mainTrade} en Querétaro | Maestro Cerca`,
      text: `Contacta a ${worker.firstName} (${worker.mainTrade}) en Querétaro a través de Maestro Cerca.`,
      url: canonicalUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopiedLink(true);
      showToast('Enlace del perfil copiado al portapapeles');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    setIsSubmittingReport(true);
    const fullReason = reportDetails.trim() 
      ? `${reportReason.trim()} - Detalle: ${reportDetails.trim()}`
      : reportReason.trim();

    const res = await submitProfileReport(worker.id, fullReason);
    setIsSubmittingReport(false);

    if (res.success) {
      setReportSuccess(true);
      showToast(res.message || 'Reporte enviado con éxito. Nuestro equipo lo revisará.');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
        setReportDetails('');
      }, 2000);
    } else {
      showToast(res.error || 'Error al enviar el reporte.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-28 sm:pb-20">
      
      {/* Top back bar */}
      <div className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigateTo({ type: 'search' })}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la búsqueda</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-orange-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Compartir perfil"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden xs:inline">{copiedLink ? '¡Enlace copiado!' : 'Compartir perfil'}</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
              title="Reportar usuario"
            >
              <Flag className="w-4 h-4" />
              <span className="hidden xs:inline">Reportar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        
        {/* Visibility Warning Banner for Owner / Admin */}
        {!isVisible && isOwnerOrAdmin && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start sm:items-center gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-sm">
              <span className="font-bold">Perfil en revisión o no público:</span> Este perfil no está visible para el público general (está pendiente de aprobación administrativa o marcado como no disponible). Puedes visualizarlo porque eres {isAdmin ? 'administrador' : 'el propietario'}.
            </div>
          </div>
        )}

        {/* HEADER HERO CARD */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            
            {/* Avatar: Photo if approved, else generic trade avatar */}
            <div className="relative shrink-0">
              <WorkerAvatar
                worker={worker}
                alt={`${worker.firstName} ${worker.lastName}`}
                size="lg"
              />

              {isVerified && (
                <div 
                  title="Verificado por Maestro Cerca"
                  className="absolute -bottom-2.5 -right-2.5 bg-green-600 text-white p-1.5 rounded-xl shadow-md border-2 border-white"
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Main info & Title */}
            <div className="flex-1 space-y-3">
              
              <div className="flex flex-wrap items-center gap-2">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Verificado por Maestro Cerca
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                    Registrado
                  </span>
                )}
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  En Maestro Cerca desde {new Date(worker.joinedDate).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                </span>
                {typeof worker.contactCount === 'number' && worker.contactCount > 0 && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {worker.contactCount} {worker.contactCount === 1 ? 'contacto' : 'contactos'} a través de Maestro Cerca
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {worker.firstName} {worker.lastName}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700 font-medium">
                <span className="font-bold text-orange-600 text-base">
                  {worker.mainTrade}
                </span>

                <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>{worker.yearsExperience} años de experiencia</span>
                </div>

                <div className="flex items-center gap-1 text-slate-600">
                  <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>{mainArea ? `Zona principal: ${mainArea}` : 'Zona principal no especificada'}</span>
                </div>
              </div>

              {/* Secondary trades */}
              {worker.secondaryTrades && worker.secondaryTrades.length > 0 && (
                <p className="text-xs text-slate-500 font-medium">
                  También realiza trabajos de:{' '}
                  <span className="text-slate-700 font-semibold">
                    {worker.secondaryTrades.join(', ')}
                  </span>
                </p>
              )}

            </div>

          </div>

          {/* Availability Paused Notice if worker.isAvailable === false */}
          {worker.isAvailable === false && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">Este trabajador no está disponible temporalmente</p>
                <p className="text-xs text-amber-800">Actualmente no está recibiendo nuevas solicitudes ni cotizaciones de clientes.</p>
              </div>
            </div>
          )}

          {/* Desktop Contact CTA Row */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3 sm:gap-4">
            {worker.isAvailable === false ? (
              <div className="flex-1 p-3.5 bg-slate-100 rounded-xl text-slate-600 text-xs sm:text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Contacto desactivado temporalmente (el trabajador pausó su disponibilidad)</span>
              </div>
            ) : (
              <>
                <button
                  id="profile-whatsapp-cta"
                  onClick={handleWhatsApp}
                  className="flex-1 sm:flex-none py-3.5 px-6 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Contactar por WhatsApp</span>
                </button>

                <button
                  id="profile-phone-cta"
                  onClick={handlePhone}
                  className="py-3.5 px-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-[0.99] text-slate-900 font-bold text-sm sm:text-base rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Phone className="w-5 h-5 text-slate-700" />
                  <span>Llamar</span>
                </button>
              </>
            )}

            <div className="text-xs text-slate-600 ml-auto flex items-center gap-1.5 font-medium">
              <span className={`w-2 h-2 rounded-full ${worker.isAvailable === false ? 'bg-amber-400' : 'bg-green-500'}`} />
              <span>{worker.isAvailable === false ? 'Perfil en pausa' : 'Trato directo con el especialista'}</span>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT MAIN CONTENT (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* 1. TOP PRIORITY SECTION: TRABAJOS REALIZADOS (PHOTO GALLERY) */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-orange-600" />
                    <span>Trabajos realizados</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Fotografías de proyectos y reparaciones terminadas
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  {workPhotosList.length} fotos
                </span>
              </div>

              {workPhotosList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {workPhotosList.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer aspect-4/3 shadow-xs hover:shadow-md transition-all"
                    >
                      <img
                        src={photo.url}
                        alt={photo.title}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end text-white">
                        <p className="font-bold text-sm leading-tight drop-shadow-xs">
                          {photo.title}
                        </p>
                        {photo.description && (
                          <p className="text-xs text-slate-200 line-clamp-1 mt-0.5 font-normal">
                            {photo.description}
                          </p>
                        )}
                        <span className="text-[10px] text-orange-300 font-semibold mt-1">
                          Ver imagen completa →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Sin fotografías de trabajos aún</p>
                  <p className="text-xs text-slate-500">El trabajador no ha subido fotografías de sus proyectos.</p>
                </div>
              )}
            </section>

            {/* 2. TRABAJOS QUE REALIZA */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-600" />
                  <span>Trabajos que realiza</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Servicios y tipos de trabajos específicos que puedes solicitarle
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {worker.services && worker.services.length > 0 ? (
                  worker.services.map((service, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/70 flex items-start gap-2.5 text-sm text-slate-900 font-medium"
                    >
                      <Check className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <span>{service}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Mantenimiento y trabajos especializados de {worker.mainTrade}.</p>
                )}
              </div>
            </section>

            {/* 3. ACERCA DE */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-orange-600" />
                <span>Acerca de {worker.firstName}</span>
              </h2>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal">
                {worker.description}
              </p>
            </section>

          </div>

          {/* RIGHT SIDEBAR (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 4. VERIFICACIONES DE CONFIANZA */}
            <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Award className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Señales de confianza
                </h3>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm">
                
                {/* Teléfono verificado */}
                <li className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold ${
                    worker.phoneVerified ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {worker.phoneVerified ? '✓' : '—'}
                  </div>
                  <div>
                    <p className={`font-semibold ${worker.phoneVerified ? 'text-slate-900' : 'text-slate-500'}`}>
                      Teléfono y WhatsApp verificado
                    </p>
                    <p className="text-[11px] text-slate-600">Contacto comprobado con el maestro</p>
                  </div>
                </li>

                {/* Fotografías revisadas */}
                <li className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold ${
                    worker.photosReviewed ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {worker.photosReviewed ? '✓' : '—'}
                  </div>
                  <div>
                    <p className={`font-semibold ${worker.photosReviewed ? 'text-slate-900' : 'text-slate-500'}`}>
                      Fotografías revisadas
                    </p>
                    <p className="text-[11px] text-slate-600">Muestras de trabajos comprobadas</p>
                  </div>
                </li>

                {/* Identidad revisada */}
                <li className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold ${
                    worker.identityVerified ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {worker.identityVerified ? '✓' : '—'}
                  </div>
                  <div>
                    <p className={`font-semibold ${worker.identityVerified ? 'text-slate-900' : 'text-slate-500'}`}>
                      Identidad confirmada
                    </p>
                    <p className="text-[11px] text-slate-600">Perfil y datos de contacto comprobados</p>
                  </div>
                </li>

                {/* Referencias comprobadas */}
                <li className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold ${
                    worker.referencesVerified ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {worker.referencesVerified ? '✓' : '—'}
                  </div>
                  <div>
                    <p className={`font-semibold ${worker.referencesVerified ? 'text-slate-900' : 'text-slate-500'}`}>
                      Referencias comprobadas
                    </p>
                    <p className="text-[11px] text-slate-600">Experiencia previa comprobada</p>
                  </div>
                </li>

              </ul>
            </section>

            {/* 5. ZONAS DONDE TRABAJA */}
            <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <MapPin className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Zonas de cobertura
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {worker.firstName} realiza visitas y cotizaciones en las siguientes zonas:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {worker.serviceAreas.map((area, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-xl bg-orange-50 border border-orange-200/80 text-orange-900 text-xs font-semibold"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </section>

            {/* 6. EXPERIENCIA */}
            <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Clock className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Experiencia profesional
                </h3>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <p className="font-bold text-orange-900 text-lg">
                  {worker.yearsExperience} años en el oficio
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Especializado en proyectos residenciales, mantenimiento preventivo y correctivo.
                </p>
              </div>
            </section>

            {/* 7. AVISO LEGAL DISCRETO */}
            <div className="p-4 rounded-2xl bg-slate-100/90 border border-slate-200 text-slate-600 text-xs leading-relaxed flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Aviso:</strong> Maestro Cerca facilita el contacto entre clientes y trabajadores independientes. Los acuerdos, precios y ejecución de los trabajos se realizan directamente entre ambas partes.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Reportar este perfil o datos sospechosos</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL: REPORTAR TRABAJADOR */}
      {showReportModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmittingReport && setShowReportModal(false)}
        >
          <div 
            className="relative max-w-md w-full bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowReportModal(false)}
              disabled={isSubmittingReport}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Reportar perfil</h3>
                <p className="text-xs text-slate-500">{worker.firstName} {worker.lastName} ({worker.mainTrade})</p>
              </div>
            </div>

            {reportSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-base font-black text-slate-900">Reporte recibido</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Agradecemos tu reporte. Nuestro equipo de administración lo revisará para mantener la seguridad y confianza en Maestro Cerca.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Motivo principal
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    disabled={isSubmittingReport}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="Información o datos de contacto falsos">Información o datos de contacto falsos</option>
                    <option value="Fotografías no corresponden o son inapropiadas">Fotografías no corresponden o son inapropiadas</option>
                    <option value="Comportamiento abusivo o spam">Comportamiento abusivo o spam</option>
                    <option value="Incumplimiento o mala práctica">Incumplimiento o mala práctica</option>
                    <option value="Cobro indebido o fraude">Cobro indebido o fraude</option>
                    <option value="Otro motivo">Otro motivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Detalles adicionales (opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    disabled={isSubmittingReport}
                    placeholder="Describe brevemente la situación para ayudarnos a investigar..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Tu reporte es anónimo y confidencial. Se registrará para auditoría del equipo de administración de Maestro Cerca.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    disabled={isSubmittingReport}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingReport ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Flag className="w-3.5 h-3.5" />
                        <span>Enviar reporte</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MOBILE STICKY BOTTOM CONTACT BAR */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:hidden z-30 shadow-2xl">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          {worker.isAvailable === false ? (
            <div className="w-full py-2.5 px-4 bg-slate-100 rounded-xl text-slate-600 text-xs font-semibold text-center flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Trabajador no disponible temporalmente</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleWhatsApp}
                className="flex-1 py-3 px-4 bg-green-600 active:bg-green-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contactar WhatsApp</span>
              </button>
              <button
                onClick={handlePhone}
                className="py-3 px-4 bg-slate-100 active:bg-slate-200 text-slate-900 font-bold text-sm rounded-xl flex items-center justify-center gap-1.5"
              >
                <Phone className="w-4 h-4" />
                <span>Llamar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* LIGHTBOX MODAL FOR FULL-SIZE WORK PHOTOS */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="max-h-[75vh] bg-black flex items-center justify-center">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title}
                className="max-h-[75vh] w-full object-contain"
              />
            </div>

            <div className="p-6 bg-slate-900 text-white">
              <h3 className="text-lg font-bold">{selectedPhoto.title}</h3>
              {selectedPhoto.description && (
                <p className="text-sm text-slate-300 mt-1 font-normal leading-relaxed">
                  {selectedPhoto.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
