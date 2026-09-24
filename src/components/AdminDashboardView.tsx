import React, { useState, useEffect } from 'react';
import { 
  Users, 
  User,
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  BarChart3, 
  Search, 
  Phone, 
  MessageCircle, 
  SlidersHorizontal, 
  Lock, 
  Plus, 
  Eye, 
  Check, 
  X, 
  ArrowLeft, 
  Clock, 
  Hammer, 
  MapPin, 
  ExternalLink,
  Trash2,
  FileText,
  Building2,
  LogOut,
  ChevronRight,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

import { useStore, DESIGNATED_ADMIN_EMAILS } from '../context/StoreContext';
import { WorkerAvatar } from './WorkerAvatar';
import { Maestro, Worker, Trade, ServiceArea, VerificationStatus, ProfileStatus } from '../types';
import { sanitizeMexicanPhone } from '../lib/whatsapp';
import { AdminGuard } from './AdminGuard';
import { getSecureTransientBlobUrl, listWorkerVerificationDocs } from '../lib/storage';

export const AdminDashboardView: React.FC = () => {
  const { 
    workers, 
    maestros,
    trades, 
    serviceAreas, 
    contactEvents, 
    solicitudesContacto,
    analytics, 
    navigateTo, 
    adminSetVerificationStatus, 
    adminApproveMaestro,
    adminSetProfileStatus,
    adminVerifyMaestro,
    adminUpdateMaestroTier,
    adminDeleteMaestro,
    adminAddTrade, 
    adminToggleTrade, 
    adminAddServiceArea, 
    adminToggleServiceArea,
    fetchPrivateVerificationDossier,
    adminReviewProfilePhoto,
    adminFetchProfileReports,
    adminUpdateReportStatus,
    showToast,
    firebaseUser,
    isAuthLoading,
    isAdmin,
    loginAdmin,
    loginAdminWithGoogle,
    logoutWorker,
    contactarWhatsApp
  } = useStore();

  const [statusAlertModal, setStatusAlertModal] = useState<string | null>(null);
  const [isUpdatingStatusId, setIsUpdatingStatusId] = useState<string | null>(null);

  // Zero-leak private verification dossier inspection states
  const [dossierLoading, setDossierLoading] = useState(false);
  const [privateDossier, setPrivateDossier] = useState<any>(null);
  const [transientDoc, setTransientDoc] = useState<{ blobUrl: string; contentType: string; revoke: () => void } | null>(null);

  // Profile photo moderation state
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<{ blobUrl: string; contentType: string; revoke: () => void } | null>(null);
  const [isReviewingPhoto, setIsReviewingPhoto] = useState(false);

  // Profile reports state
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'reviewed' | 'dismissed'>('pending');

  // Admin login form states
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active dashboard tabs
  const [activeTab, setActiveTab] = useState<'maestros' | 'leads' | 'reports' | 'analytics' | 'trades' | 'areas'>('maestros');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterApproval, setFilterApproval] = useState<'all' | 'Aprobado' | 'Pendiente'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'review' | 'registered'>('all');

  // Profile status update handler with SMS phone verification enforcement
  const handleProfileStatusChange = async (maestroId: string, newStatus: ProfileStatus) => {
    setIsUpdatingStatusId(maestroId);
    try {
      const res = await adminSetProfileStatus(maestroId, newStatus);
      if (res && !res.success) {
        setStatusAlertModal(res.error || 'No se pudo cambiar el status del perfil.');
      } else {
        showToast(newStatus === 'Aprobado' ? 'Perfil aprobado exitosamente.' : 'Perfil puesto en estado Pendiente.');
      }
    } finally {
      setIsUpdatingStatusId(null);
    }
  };

  // New trade & area inputs
  const [newTradeName, setNewTradeName] = useState('');
  const [newTradeDesc, setNewTradeDesc] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaMun, setNewAreaMun] = useState('El Marqués');

  // Worker detail modal for verification review
  const [reviewingMaestro, setReviewingMaestro] = useState<Maestro | null>(null);
  const [checkPhotos, setCheckPhotos] = useState(true);
  const [checkId, setCheckId] = useState(true);
  const [checkRefs, setCheckRefs] = useState(true);

  // Delete confirmation
  const [deletingMaestroId, setDeletingMaestroId] = useState<string | null>(null);

  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const res = await loginAdmin(adminEmail, adminPassword);
      if (!res.success) {
        setAuthError(res.error || 'Credenciales administrativas no válidas.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const res = await loginAdminWithGoogle();
      if (!res.success) {
        setAuthError(res.error || 'No se pudo iniciar sesión con Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Open inspection modal with zero-leak authenticated blob loading
  const handleOpenReview = async (maestro: Maestro) => {
    setReviewingMaestro(maestro);
    setCheckPhotos(Boolean(maestro.photosReviewed));
    setCheckId(Boolean(maestro.identityVerified));
    setCheckRefs(Boolean(maestro.referencesVerified));

    if (transientDoc) {
      transientDoc.revoke();
      setTransientDoc(null);
    }
    if (pendingPhotoBlob) {
      pendingPhotoBlob.revoke();
      setPendingPhotoBlob(null);
    }
    setPrivateDossier(null);
    setDossierLoading(true);

    try {
      const dossier = await fetchPrivateVerificationDossier(maestro.id);
      setPrivateDossier(dossier);

      let docPath = dossier?.idDocStoragePath || (dossier?.documents && dossier.documents[0]);
      if (!docPath) {
        const docs = await listWorkerVerificationDocs(maestro.userId || maestro.id);
        if (docs.length > 0) {
          docPath = docs[0];
        }
      }

      if (docPath) {
        const secureBlob = await getSecureTransientBlobUrl(docPath);
        setTransientDoc(secureBlob);
      }

      // Check for pending profile photo needing review
      const pendingPhotoPath = maestro.pendingProfilePhotoPath || dossier?.pendingProfilePhotoPath;
      if (pendingPhotoPath) {
        try {
          const photoBlob = await getSecureTransientBlobUrl(pendingPhotoPath);
          setPendingPhotoBlob(photoBlob);
        } catch (photoErr) {
          console.warn('Could not load pending profile photo blob:', photoErr);
        }
      }
    } catch (err) {
      console.warn('Could not load secure transient blob:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  const handleCloseReview = () => {
    if (transientDoc) {
      transientDoc.revoke();
      setTransientDoc(null);
    }
    if (pendingPhotoBlob) {
      pendingPhotoBlob.revoke();
      setPendingPhotoBlob(null);
    }
    setPrivateDossier(null);
    setReviewingMaestro(null);
  };

  // Profile photo review handlers
  const handleApprovePhoto = async () => {
    if (!reviewingMaestro) return;
    setIsReviewingPhoto(true);
    const res = await adminReviewProfilePhoto(reviewingMaestro.id, 'approve');
    setIsReviewingPhoto(false);
    if (res.success) {
      showToast(res.message || 'Fotografía de perfil aprobada exitosamente.');
      if (pendingPhotoBlob) {
        pendingPhotoBlob.revoke();
        setPendingPhotoBlob(null);
      }
      setReviewingMaestro({
        ...reviewingMaestro,
        profilePhotoReviewStatus: 'approved',
        pendingProfilePhotoPath: undefined,
      });
    } else {
      showToast(res.error || 'Error al aprobar la fotografía.');
    }
  };

  const handleRejectPhoto = async () => {
    if (!reviewingMaestro) return;
    setIsReviewingPhoto(true);
    const res = await adminReviewProfilePhoto(reviewingMaestro.id, 'reject');
    setIsReviewingPhoto(false);
    if (res.success) {
      showToast(res.message || 'Fotografía de perfil rechazada.');
      if (pendingPhotoBlob) {
        pendingPhotoBlob.revoke();
        setPendingPhotoBlob(null);
      }
      setReviewingMaestro({
        ...reviewingMaestro,
        profilePhotoReviewStatus: 'rejected',
        pendingProfilePhotoPath: undefined,
      });
    } else {
      showToast(res.error || 'Error al rechazar la fotografía.');
    }
  };

  // Reports management
  const loadReports = React.useCallback(async () => {
    setReportsLoading(true);
    const res = await adminFetchProfileReports();
    if (res.success && res.reports) {
      setReports(res.reports);
    }
    setReportsLoading(false);
  }, [adminFetchProfileReports]);

  React.useEffect(() => {
    if (activeTab === 'reports') {
      loadReports();
    }
  }, [activeTab, loadReports]);

  const handleUpdateReportStatus = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    const res = await adminUpdateReportStatus(reportId, status);
    if (res.success) {
      showToast(`Reporte marcado como ${status === 'reviewed' ? 'revisado' : 'descartado'}`);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
    } else {
      showToast(res.error || 'No se pudo actualizar el reporte');
    }
  };

  const isPhoneVerified = Boolean(
    reviewingMaestro?.phoneVerified === true ||
    reviewingMaestro?.phoneVerificationMethod === 'firebase_sms' ||
    reviewingMaestro?.phoneVerificationMethod === 'sms'
  );

  // Expediente verification checklist handlers (3 mandatory core requirements: phone, photos, ID)
  const allRequirementsChecked = isPhoneVerified && checkPhotos && checkId;

  const handleApproveVerification = async () => {
    if (!reviewingMaestro) return;
    if (!allRequirementsChecked) {
      return;
    }
    await adminVerifyMaestro(reviewingMaestro.id, true, {
      identityVerified: checkId,
      referencesVerified: checkRefs,
      photosReviewed: checkPhotos,
      adminEmail: firebaseUser?.email || 'admin',
    });
    handleCloseReview();
  };

  const handleRejectVerification = async () => {
    if (!reviewingMaestro) return;
    await adminVerifyMaestro(reviewingMaestro.id, false, {
      identityVerified: false,
      referencesVerified: false,
      photosReviewed: false,
      adminEmail: firebaseUser?.email || 'admin',
    });
    handleCloseReview();
  };

  const handleSaveRequirementsOnly = async () => {
    if (!reviewingMaestro) return;
    const isCurrentlyVerified = reviewingMaestro.verificado === true || reviewingMaestro.verificationStatus === 'verified';
    await adminVerifyMaestro(reviewingMaestro.id, isCurrentlyVerified, {
      identityVerified: checkId,
      referencesVerified: checkRefs,
      photosReviewed: checkPhotos,
      adminEmail: firebaseUser?.email || 'admin',
    });
    handleCloseReview();
  };

  // Handle delete confirmation
  const [isDeletingMaestro, setIsDeletingMaestro] = useState(false);
  const handleConfirmDelete = async () => {
    if (!deletingMaestroId || isDeletingMaestro) return;
    setIsDeletingMaestro(true);
    try {
      const res = await adminDeleteMaestro(deletingMaestroId);
      if (res?.success) {
        setDeletingMaestroId(null);
      }
    } finally {
      setIsDeletingMaestro(false);
    }
  };

  // Authorized Administrator Dashboard data computation
  const totalMaestros = maestros.length;
  const approvedCount = maestros.filter((m) => m.statusPerfil === 'Aprobado' || (m.statusPerfil === 'Activo' && m.aprobado === true) || (m.statusPerfil === undefined && m.aprobado === true)).length;
  const pendingCount = maestros.filter((m) => m.statusPerfil === 'Pendiente' || (m.statusPerfil !== 'Aprobado' && m.statusPerfil !== 'Activo' && m.aprobado !== true)).length;
  const verifiedCount = maestros.filter((m) => m.verificado === true || m.verificationStatus === 'verified').length;
  const inReviewCount = maestros.filter((m) => m.tieneVerificacionPendiente).length;
  const totalLeads = solicitudesContacto.length;

  // Filter maestros
  const filteredMaestros = maestros.filter((m) => {
    const searchString = `${m.nombre} ${m.oficio} ${m.telefonoWhatsApp || ''} ${m.email || ''}`.toLowerCase();
    const matchSearch = searchString.includes(searchTerm.toLowerCase());
    const matchTrade = filterTrade ? (m.oficio === filterTrade || m.mainTrade === filterTrade) : true;
    
    const isApproved = m.statusPerfil === 'Aprobado' || m.statusPerfil === 'Activo' || (m.statusPerfil === undefined && m.aprobado === true);
    const maestroStatus: ProfileStatus = isApproved ? 'Aprobado' : 'Pendiente';
    const isDraft = m.status === 'draft' || m.registrationMethod === 'manychat_csv';
    let matchApproval = true;
    if (filterApproval === 'Aprobado') matchApproval = isApproved && !isDraft;
    if (filterApproval === 'Pendiente') matchApproval = !isApproved && !isDraft;
    if (filterApproval === 'draft') matchApproval = isDraft;

    const isVerif = m.verificado === true || m.verificationStatus === 'verified';
    let matchStatus = true;
    if (filterStatus === 'verified') matchStatus = isVerif;
    if (filterStatus === 'review') matchStatus = Boolean(m.tieneVerificacionPendiente);
    if (filterStatus === 'registered') matchStatus = !isVerif;

    return matchSearch && matchTrade && matchApproval && matchStatus;
  });

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#FAFAFA] pb-24">
      {/* Admin Top Banner */}
      <div className="bg-slate-900 text-white py-6 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400 mb-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Panel de Control Administrativo • Maestro Cerca</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Gestión y Seguridad de Maestros
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Sesión activa como <span className="text-orange-300 font-semibold">{firebaseUser?.email || firebaseUser?.phoneNumber || 'Administrador'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateTo({ type: 'home' })}
              className="py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Ver Directorio Público</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={logoutWorker}
              className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* KPI METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Maestros</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalMaestros}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Base en tiempo real</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-green-200 bg-green-50/20 shadow-xs">
            <p className="text-xs font-bold text-green-700 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Perfiles Aprobados
            </p>
            <p className="text-2xl sm:text-3xl font-black text-green-700 mt-1">{approvedCount}</p>
            <p className="text-[11px] text-green-600 mt-0.5">Aprobados para directorio</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <p className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Perfiles Pendientes
            </p>
            <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">{pendingCount}</p>
            <p className="text-[11px] text-amber-600 mt-0.5">En espera de aprobación</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verificados
            </p>
            <p className="text-2xl sm:text-3xl font-black text-blue-700 mt-1">{verifiedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Con insignia oficial</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
            <p className="text-xs font-bold text-green-600 uppercase flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              Leads WhatsApp
            </p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalLeads}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Solicitudes registradas</p>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-px">
          {[
            { id: 'maestros', label: `Maestros & Aprobación (${totalMaestros})`, icon: <Users className="w-4 h-4" /> },
            { id: 'reports', label: `Reportes (${reports.filter(r => r.status === 'pending').length || reports.length})`, icon: <AlertTriangle className="w-4 h-4" /> },
            { id: 'leads', label: `Solicitudes de Contacto (${totalLeads})`, icon: <MessageCircle className="w-4 h-4" /> },
            { id: 'analytics', label: 'Analítica de Plataforma', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'trades', label: `Oficios (${trades.length})`, icon: <Hammer className="w-4 h-4" /> },
            { id: 'areas', label: `Zonas Querétaro (${serviceAreas.length})`, icon: <MapPin className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-orange-600 text-orange-600 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: MAESTROS (APPROVAL & DIRECTORY MANAGEMENT) */}
        {activeTab === 'maestros' && (
          <div className="space-y-4">
            
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar maestro, teléfono u oficio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <select
                value={filterTrade}
                onChange={(e) => setFilterTrade(e.target.value)}
                className="w-full md:w-48 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="">Todos los oficios</option>
                {trades.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>

              <select
                value={filterApproval}
                onChange={(e) => setFilterApproval(e.target.value as any)}
                className="w-full md:w-52 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="all">Todos los status</option>
                <option value="Aprobado">✓ Aprobados</option>
                <option value="Pendiente">⏳ Pendientes</option>
                <option value="draft">📝 Borradores (ManyChat)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full md:w-48 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="all">Todas las verificaciones</option>
                <option value="verified">✓ Verificados</option>
                <option value="review">⏳ En revisión</option>
                <option value="registered">No verificados</option>
              </select>

              <div className="text-xs text-slate-500 ml-auto font-medium">
                Mostrando {filteredMaestros.length} de {maestros.length}
              </div>
            </div>

            {/* Table of Maestros */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Maestro</th>
                      <th className="py-3.5 px-4">Oficio</th>
                      <th className="py-3.5 px-4">Ubicación</th>
                      <th className="py-3.5 px-4">WhatsApp</th>
                      <th className="py-3.5 px-4 text-center">Status de perfil</th>
                      <th className="py-3.5 px-4 text-center">Verificación</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaestros.map((m) => {
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <WorkerAvatar
                                worker={m}
                                alt={m.nombre}
                                size="custom"
                                className="w-10 h-10 !rounded-full shrink-0"
                                imgClassName="rounded-full"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{m.nombre}</p>
                                  {(m.profilePhotoReviewStatus === 'pending' || m.pendingProfilePhotoPath) && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300" title="Nueva foto de perfil pendiente de moderación">
                                      Foto pendiente
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500">ID: {m.id.substring(0, 10)}...</p>
                              </div>
                            </div>
                          </td>

                          {/* Clean Oficio column - without manual level dropdown */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200/60">
                              {m.oficio || m.mainTrade || 'Sin oficio'}
                            </span>
                          </td>

                          {/* Clean Ubicación column - real location/areas without hardcoded Zibata indicators */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-medium text-slate-700 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[180px]" title={m.serviceAreas?.join(', ') || m.location || 'Sin ubicación registrada'}>
                                {m.serviceAreas && m.serviceAreas.length > 0
                                  ? m.serviceAreas.join(', ')
                                  : m.location || 'Sin ubicación registrada'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => contactarWhatsApp(m)}
                              className="flex items-center gap-1.5 text-green-700 hover:text-green-800 font-semibold cursor-pointer"
                              title="Probar enlace de WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                              <span>{sanitizeMexicanPhone(m.telefonoWhatsApp || m.whatsapp || '').displayFormat}</span>
                            </button>
                          </td>

                          {/* Status de perfil: Dos únicos estados (Pendiente / Aprobado) + Indicador independiente de disponibilidad */}
                          <td className="py-3.5 px-4 text-center">
                            {(() => {
                              const isApproved = m.statusPerfil === 'Aprobado' || m.statusPerfil === 'Activo' || (m.statusPerfil === undefined && m.aprobado === true);
                              const currentStatus: ProfileStatus = isApproved ? 'Aprobado' : 'Pendiente';
                              const isUpdating = isUpdatingStatusId === m.id;

                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <select
                                    id={`profile-status-select-${m.id}`}
                                    value={currentStatus}
                                    disabled={isUpdating}
                                    onChange={(e) => handleProfileStatusChange(m.id, e.target.value as ProfileStatus)}
                                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                                      currentStatus === 'Aprobado'
                                        ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100'
                                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                    } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                                    title="Status administrativo del perfil (Pendiente o Aprobado)"
                                  >
                                    <option value="Pendiente">⏳ Pendiente</option>
                                    <option value="Aprobado">✓ Aprobado</option>
                                  </select>

                                  {(m.status === 'draft' || m.registrationMethod === 'manychat_csv') && (
                                    <span className="text-[9px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200/80">
                                      Borrador ManyChat
                                    </span>
                                  )}

                                  {/* Indicador independiente de disponibilidad (controlado por el trabajador) */}
                                  {m.isAvailable !== false ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700" title="Disponibilidad personal: Activa (controlada por el trabajador en su dashboard)">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                      <span>Disponible</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700" title="Disponibilidad personal: Pausada por el trabajador desde su dashboard">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                      <span>Pausado por trabajador</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Verificación: Informativa solamente */}
                          <td className="py-3.5 px-4 text-center">
                            {(() => {
                              const isVerified = m.verificado === true || m.verificationStatus === 'verified';
                              const inReview = Boolean(m.tieneVerificacionPendiente);

                              if (isVerified) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Verificado</span>
                                  </span>
                                );
                              }
                              if (inReview) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>En revisión</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  <span>No verificado</span>
                                </span>
                              );
                            })()}
                          </td>

                          {/* Acciones: Botón Expediente y Eliminar */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                id={`btn-review-dossier-${m.id}`}
                                onClick={() => handleOpenReview(m)}
                                className="py-1.5 px-3 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                title="Abrir expediente de verificación"
                              >
                                <FileText className="w-3.5 h-3.5 text-orange-400" />
                                <span>Expediente</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingMaestroId(m.id)}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar perfil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: REPORTES DE USUARIOS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>Reportes de Perfiles Públicos</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Incidentes y reportes enviados por clientes desde el botón "Reportar usuario" en los perfiles.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadReports}
                    disabled={reportsLoading}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                  <span className="py-1 px-3 bg-amber-100 text-amber-800 text-xs font-black rounded-full">
                    {reports.filter(r => (r.status || 'pending') === 'pending').length} Pendientes
                  </span>
                </div>
              </div>

              {/* Status filter buttons */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-4 overflow-x-auto">
                {[
                  { id: 'all', label: `Todos (${reports.length})` },
                  { id: 'pending', label: `Pendientes (${reports.filter(r => (r.status || 'pending') === 'pending').length})` },
                  { id: 'reviewed', label: `Revisados (${reports.filter(r => r.status === 'reviewed').length})` },
                  { id: 'dismissed', label: `Descartados (${reports.filter(r => r.status === 'dismissed').length})` },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setReportStatusFilter(st.id as any)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      reportStatusFilter === st.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports List / Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Trabajador Reportado</th>
                      <th className="py-3 px-4">Motivo</th>
                      <th className="py-3 px-4">Detalles</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {reportsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <span>Cargando reportes...</span>
                          </div>
                        </td>
                      </tr>
                    ) : reports.filter(r => reportStatusFilter === 'all' || (r.status || 'pending') === reportStatusFilter).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <CheckCircle2 className="w-8 h-8 text-slate-300" />
                            <p className="font-semibold text-slate-500">No hay reportes con este estado</p>
                            <p className="text-[11px] text-slate-400">No se encontraron denuncias ciudadanas registradas en esta categoría.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      reports
                        .filter(r => reportStatusFilter === 'all' || (r.status || 'pending') === reportStatusFilter)
                        .map((report) => {
                          const matchingMaestro = maestros.find(m => m.id === report.workerId || m.userId === report.workerId);
                          const reportDate = report.createdAt ? new Date(report.createdAt).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Reciente';

                          return (
                            <tr key={report.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-500">
                                {reportDate}
                              </td>

                              <td className="py-3.5 px-4">
                                <div>
                                  <p className="font-bold text-slate-900 text-xs sm:text-sm">
                                    {matchingMaestro ? matchingMaestro.nombre : (report.workerName || 'Trabajador')}
                                  </p>
                                  <p className="text-[11px] text-orange-600 font-semibold">
                                    {matchingMaestro?.oficio || 'Oficio no disponible'}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    ID: {report.workerId?.substring(0, 10)}...
                                  </p>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  {report.reason || 'Sin motivo'}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 max-w-xs">
                                <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">
                                  {report.details || 'Sin comentarios adicionales.'}
                                </p>
                              </td>

                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {report.status === 'reviewed' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Revisado</span>
                                  </span>
                                ) : report.status === 'dismissed' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    <span>Descartado</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Pendiente</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {matchingMaestro && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReview(matchingMaestro)}
                                      className="py-1 px-2.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                      title="Inspeccionar perfil y expediente del trabajador"
                                    >
                                      <FileText className="w-3 h-3 text-orange-400" />
                                      <span>Inspeccionar</span>
                                    </button>
                                  )}
                                  {report.status !== 'reviewed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateReportStatus(report.id, 'reviewed')}
                                      className="py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                      title="Marcar como atendido y revisado"
                                    >
                                      ✓ Atender
                                    </button>
                                  )}
                                  {report.status !== 'dismissed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                                      className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                      title="Descartar reporte"
                                    >
                                      Descartar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SOLICITUDES DE CONTACTO (LEADS ANALYTICS) */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registro de Contactos en Tiempo Real</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cada clic en "Contactar por WhatsApp" o "Llamar" genera un registro en la colección <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">solicitudes_contacto</code>.
                  </p>
                </div>
                <span className="py-1 px-3 bg-green-100 text-green-800 text-xs font-black rounded-full">
                  {solicitudesContacto.length} Leads Registrados
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Fecha y Hora</th>
                      <th className="py-3.5 px-4">Maestro Contactado</th>
                      <th className="py-3.5 px-4">Oficio</th>
                      <th className="py-3.5 px-4">Canal</th>
                      <th className="py-3.5 px-4">Teléfono Destino</th>
                      <th className="py-3.5 px-4">Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {solicitudesContacto.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                          No hay solicitudes de contacto registradas aún.
                        </td>
                      </tr>
                    ) : (
                      solicitudesContacto.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {new Date(s.fecha).toLocaleString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {s.maestroNombre || s.maestroId}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                              {s.oficio || 'Mantenimiento'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-green-700 font-bold">
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {s.telefono || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                              {s.origen}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PLATFORM ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase">Visitas Home</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{analytics.visitas_home}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase">Búsquedas Realizadas</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{analytics.busqueda_realizada}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase">Perfiles Visualizados</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{analytics.perfil_visualizado}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase">Registros Completados</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{analytics.registro_trabajador_completado}</p>
              </div>
            </div>

            {/* Trade & Area demand breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-700">Demanda por Oficio en Zibatá</h4>
                <div className="space-y-2">
                  {Object.entries(analytics.oficio_buscado || {}).map(([trade, count]) => (
                    <div key={trade} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                      <span className="font-semibold text-slate-800">{trade}</span>
                      <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{count} búsquedas</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-700">Demanda por Zonas</h4>
                <div className="space-y-2">
                  {Object.entries(analytics.zona_buscada || {}).map(([area, count]) => (
                    <div key={area} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                      <span className="font-semibold text-slate-800">{area}</span>
                      <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{count} consultas</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TRADES (OFICIOS) */}
        {activeTab === 'trades' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-3">Agregar Nuevo Oficio al Catálogo</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Nombre (ej. Cerrajero, Jardinero)"
                  value={newTradeName}
                  onChange={(e) => setNewTradeName(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                />
                <input
                  type="text"
                  placeholder="Descripción corta del servicio"
                  value={newTradeDesc}
                  onChange={(e) => setNewTradeDesc(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newTradeName) return;
                    await adminAddTrade({
                      name: newTradeName,
                      slug: newTradeName.toLowerCase().replace(/\s+/g, '-'),
                      description: newTradeDesc || 'Servicios especializados en Querétaro',
                      iconName: 'Hammer',
                      popular: false,
                      active: true,
                    });
                    setNewTradeName('');
                    setNewTradeDesc('');
                  }}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar Oficio</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {trades.map((t) => (
                <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-xs sm:text-sm">{t.name}</p>
                    <p className="text-[11px] text-slate-500">{t.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => adminToggleTrade(t.id)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                      t.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: SERVICE AREAS */}
        {activeTab === 'areas' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-3">Agregar Nueva Zona de Cobertura</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Nombre de la zona (ej. La Pradera)"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                />
                <select
                  value={newAreaMun}
                  onChange={(e) => setNewAreaMun(e.target.value)}
                  className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="El Marqués">El Marqués</option>
                  <option value="Querétaro">Querétaro</option>
                  <option value="Corregidora">Corregidora</option>
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newAreaName) return;
                    await adminAddServiceArea({
                      name: newAreaName,
                      municipality: newAreaMun,
                      state: 'Querétaro',
                      active: true,
                    });
                    setNewAreaName('');
                  }}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar Zona</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {serviceAreas.map((a) => (
                <div key={a.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-xs sm:text-sm">{a.name}</p>
                    <p className="text-[11px] text-slate-500">{a.municipality}, {a.state}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => adminToggleServiceArea(a.id)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                      a.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {a.active ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: VERIFICATION & PROFILE AUDIT */}
      {reviewingMaestro && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-xl w-full rounded-3xl p-6 border border-slate-200 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <WorkerAvatar
                  worker={reviewingMaestro}
                  alt={reviewingMaestro.nombre}
                  size="custom"
                  className="w-12 h-12 !rounded-full shrink-0"
                  imgClassName="rounded-full"
                />
                <div>
                  <h3 className="text-lg font-black text-slate-900">{reviewingMaestro.nombre}</h3>
                  <p className="text-xs text-orange-600 font-bold">{reviewingMaestro.oficio}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseReview}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Checklist */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-slate-700">Requisitos de Verificación Oficial:</p>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  allRequirementsChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {[isPhoneVerified, checkPhotos, checkId, checkRefs].filter(Boolean).length} de 4 requisitos cumplidos
                </span>
              </div>
              
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200">
                <div>
                  <span className="font-bold text-xs text-slate-800 block">1. Teléfono autenticado por SMS</span>
                  <span className="text-slate-500 block text-[11px]">
                    Firebase Phone Auth ({sanitizeMexicanPhone(reviewingMaestro.telefonoWhatsApp || reviewingMaestro.whatsapp || reviewingMaestro.phone || '').displayFormat})
                  </span>
                </div>
                {isPhoneVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                    No verificado
                  </span>
                )}
              </div>

              <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={checkPhotos}
                  onChange={(e) => setCheckPhotos(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-bold">2. Fotografías de trabajos revisadas</span>
                  <span className="text-slate-500 block text-[11px]">
                    {reviewingMaestro.workPhotos?.length || 0} fotografías cargadas en el portafolio
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={checkId}
                  onChange={(e) => setCheckId(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-bold">3. Identidad revisada</span>
                  <span className="text-slate-500 block text-[11px]">
                    Identificación oficial o comprobante en archivo privado
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={checkRefs}
                  onChange={(e) => setCheckRefs(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="font-bold">4. Referencias laborales <span className="text-slate-400 font-normal">(opcional / histórico)</span></span>
                  <span className="text-slate-500 block text-[11px]">
                    Referencias previas o notas complementarias (no bloquea aprobación)
                  </span>
                </div>
              </label>
            </div>

            {/* Zero-Leak Sensitive Verification Dossier */}
            <div className="space-y-3 bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Expediente Privado Protegido (Zero-Leak)
                  </span>
                </div>
                {reviewingMaestro.tieneVerificacionPendiente && (
                  <span className="py-0.5 px-2 bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase rounded-md">
                    Pendiente de Validación
                  </span>
                )}
              </div>

              {dossierLoading ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span>Obteniendo documento de verificación seguro mediante blob efímero...</span>
                </div>
              ) : transientDoc ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-300 font-medium">
                    Documento de verificación cargado de forma segura en memoria de sesión:
                  </p>
                  {transientDoc.contentType.startsWith('image/') ? (
                    <div className="rounded-xl overflow-hidden border border-slate-700 max-h-56 bg-black flex items-center justify-center">
                      <img
                        src={transientDoc.blobUrl}
                        alt="Comprobante Técnico de Verificación"
                        className="max-h-56 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-orange-400" />
                        <span className="text-xs font-semibold">Documento de verificación (PDF)</span>
                      </div>
                      <a
                        href={transientDoc.blobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Visualizar en pestaña segura
                      </a>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 italic">
                    * El token de acceso y la URL del blob se revocarán automáticamente al cerrar este expediente.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  {privateDossier?.notes ? `Notas: ${privateDossier.notes}` : 'No se ha adjuntado identificación oficial para este perfil en el expediente privado.'}
                </p>
              )}

              {privateDossier?.referencesText && (
                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <strong className="text-slate-200">Referencias:</strong> {privateDossier.referencesText}
                </div>
              )}
            </div>

            {/* Profile Photo Moderation */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-slate-700">Foto de Perfil del Trabajador:</p>
                {reviewingMaestro.profilePhotoReviewStatus === 'approved' ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    ✓ Aprobada y pública
                  </span>
                ) : reviewingMaestro.profilePhotoReviewStatus === 'pending' || pendingPhotoBlob ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 animate-pulse">
                    ⏳ Pendiente de moderación
                  </span>
                ) : reviewingMaestro.profilePhotoReviewStatus === 'rejected' ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                    ✕ Rechazada
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-500">
                    Avatar de oficio asignado
                  </span>
                )}
              </div>

              {pendingPhotoBlob ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-4">
                    <img
                      src={pendingPhotoBlob.blobUrl}
                      alt="Foto pendiente"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-xs shrink-0"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900">Nueva foto de perfil cargada por el maestro</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Esta foto permanece privada y protegida en Storage. No será visible en el directorio ni en su perfil público hasta que sea aprobada.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isReviewingPhoto}
                      onClick={handleApprovePhoto}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Aprobar Foto de Perfil</span>
                    </button>
                    <button
                      type="button"
                      disabled={isReviewingPhoto}
                      onClick={handleRejectPhoto}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      <span>Rechazar Foto</span>
                    </button>
                  </div>
                </div>
              ) : reviewingMaestro.profilePhotoReviewStatus === 'approved' && reviewingMaestro.photoUrl ? (
                <div className="flex items-center gap-3 p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <img
                    src={reviewingMaestro.photoUrl}
                    alt="Foto aprobada"
                    className="w-12 h-12 rounded-xl object-cover border border-emerald-300"
                  />
                  <div>
                    <p className="text-xs font-bold text-emerald-900">Fotografía pública aprobada</p>
                    <p className="text-[11px] text-emerald-700">Se muestra en el catálogo y perfil público.</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  El trabajador no tiene fotos personales pendientes de revisión. Actualmente se muestra el avatar genérico de su oficio en el portal público.
                </p>
              )}
            </div>

            {/* Work Photos review preview */}
            {reviewingMaestro.workPhotos && reviewingMaestro.workPhotos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-slate-700">Fotos de trabajos realizadas:</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {reviewingMaestro.workPhotos.map((p) => (
                    <img key={p.id} src={p.url} alt={p.title} className="w-24 h-20 rounded-xl object-cover shrink-0 border border-slate-300" />
                  ))}
                </div>
              </div>
            )}

            {/* Warning if not all 3 are checked */}
            {!allRequirementsChecked && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Para marcar a este trabajador como <strong>"Verificado por Maestro Cerca"</strong> deben revisarse y cumplirse los 3 requisitos obligatorios del expediente.
                </span>
              </div>
            )}

            {/* If already verified, show audit badge */}
            {(reviewingMaestro.verificado || reviewingMaestro.verificationStatus === 'verified') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Verificado por Maestro Cerca</strong>
                    {reviewingMaestro.verifiedAt && (
                      <span className="text-blue-700 ml-1">
                        el {new Date(reviewingMaestro.verifiedAt).toLocaleDateString('es-MX')}
                      </span>
                    )}
                    {reviewingMaestro.verifiedBy && (
                      <span className="text-blue-600 ml-1">
                        por {reviewingMaestro.verifiedBy}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveRequirementsOnly}
                  className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Guardar avances de los requisitos sin alterar el estado de verificación"
                >
                  Guardar requisitos
                </button>
                <button
                  type="button"
                  onClick={handleRejectVerification}
                  className="py-2.5 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Rechazar o solicitar corrección"
                >
                  Rechazar verificación / Solicitar corrección
                </button>
              </div>

              <button
                type="button"
                onClick={handleApproveVerification}
                disabled={!allRequirementsChecked}
                className={`py-2.5 px-5 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all ${
                  allRequirementsChecked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title={allRequirementsChecked ? 'Aprobar verificación oficial' : 'Requiere los 4 requisitos completados'}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aprobar verificación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingMaestroId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-slate-900">¿Eliminar definitivamente esta cuenta?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta acción ejecutará una eliminación integral permanente en Authentication, expediente de Firestore y archivos de Storage.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingMaestro}
                onClick={() => setDeletingMaestroId(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingMaestro}
                onClick={handleConfirmDelete}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeletingMaestro ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Eliminar cuenta</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PHONE VERIFICATION WARNING / STATUS ALERT */}
      {statusAlertModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 border border-amber-200 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="text-base font-bold text-slate-900">Aprobación no permitida</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {statusAlertModal}
              </p>
              <div className="bg-amber-50 rounded-xl p-3 text-[11px] text-amber-800 text-left border border-amber-200">
                <span className="font-bold">Regla de seguridad:</span> Los trabajadores con cuenta Facebook u otros accesos deben contar con número celular confirmado por SMS antes de que su perfil pueda ser publicado en el directorio público.
              </div>
            </div>
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setStatusAlertModal(null)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </AdminGuard>
  );
};
