import React, { useState } from 'react';
import { 
  Users, 
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
  ChevronRight
} from 'lucide-react';
import { useStore, DESIGNATED_ADMIN_EMAILS } from '../context/StoreContext';
import { Maestro, Worker, Trade, ServiceArea, VerificationStatus } from '../types';
import { distanceFromZibata, coversZibata } from '../lib/geo';
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
    adminVerifyMaestro,
    adminToggleWorkerActive, 
    adminDeleteMaestro,
    adminAddTrade, 
    adminToggleTrade, 
    adminAddServiceArea, 
    adminToggleServiceArea,
    resetAllDataToSeed,
    fetchPrivateVerificationDossier,
    firebaseUser,
    isAuthLoading,
    isAdmin,
    loginAdmin,
    loginAdminWithGoogle,
    logoutWorker,
    contactarWhatsApp
  } = useStore();

  // Zero-leak private verification dossier inspection states
  const [dossierLoading, setDossierLoading] = useState(false);
  const [privateDossier, setPrivateDossier] = useState<any>(null);
  const [transientDoc, setTransientDoc] = useState<{ blobUrl: string; contentType: string; revoke: () => void } | null>(null);

  // Admin login form states
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active dashboard tabs
  const [activeTab, setActiveTab] = useState<'maestros' | 'leads' | 'analytics' | 'trades' | 'areas'>('maestros');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterApproval, setFilterApproval] = useState<'all' | 'approved' | 'pending'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'registered'>('all');

  // New trade & area inputs
  const [newTradeName, setNewTradeName] = useState('');
  const [newTradeDesc, setNewTradeDesc] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaMun, setNewAreaMun] = useState('El Marqués');

  // Worker detail modal for verification review
  const [reviewingMaestro, setReviewingMaestro] = useState<Maestro | null>(null);
  const [checkPhone, setCheckPhone] = useState(true);
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
    setCheckPhone(Boolean(maestro.phoneVerified));
    setCheckPhotos(Boolean(maestro.photosReviewed));
    setCheckId(Boolean(maestro.identityVerified));
    setCheckRefs(Boolean(maestro.referencesVerified));

    if (transientDoc) {
      transientDoc.revoke();
      setTransientDoc(null);
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
    setPrivateDossier(null);
    setReviewingMaestro(null);
  };

  // Save verification checklist
  const handleSaveVerification = async (newStatus: VerificationStatus) => {
    if (!reviewingMaestro) return;
    const isVerif = newStatus === 'verified';
    await adminVerifyMaestro(reviewingMaestro.id, isVerif, {
      phoneVerified: checkPhone,
      identityVerified: checkId,
      referencesVerified: checkRefs,
      photosReviewed: checkPhotos,
    });
    handleCloseReview();
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!deletingMaestroId) return;
    await adminDeleteMaestro(deletingMaestroId);
    setDeletingMaestroId(null);
  };

  // Authorized Administrator Dashboard data computation
  const totalMaestros = maestros.length;
  const approvedCount = maestros.filter((m) => m.aprobado === true).length;
  const pendingApprovalCount = maestros.filter((m) => m.aprobado !== true).length;
  const verifiedCount = maestros.filter((m) => m.verificado === true || m.verificationStatus === 'verified').length;
  const totalLeads = solicitudesContacto.length;

  // Filter maestros
  const filteredMaestros = maestros.filter((m) => {
    const searchString = `${m.nombre} ${m.oficio} ${m.telefonoWhatsApp || ''} ${m.email || ''}`.toLowerCase();
    const matchSearch = searchString.includes(searchTerm.toLowerCase());
    const matchTrade = filterTrade ? (m.oficio === filterTrade || m.mainTrade === filterTrade) : true;
    
    let matchApproval = true;
    if (filterApproval === 'approved') matchApproval = m.aprobado === true;
    if (filterApproval === 'pending') matchApproval = m.aprobado !== true;

    let matchStatus = true;
    if (filterStatus === 'verified') matchStatus = m.verificado === true || m.verificationStatus === 'verified';
    if (filterStatus === 'registered') matchStatus = !(m.verificado === true || m.verificationStatus === 'verified');

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
              <span>Panel de Control Administrativo • Zibatá / Querétaro</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Gestión y Seguridad de Maestros
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Sesión activa como <span className="text-orange-300 font-semibold">{firebaseUser.email}</span>
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
            <p className="text-[11px] text-slate-400 mt-0.5">Base en Firestore</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-green-200 bg-green-50/20 shadow-xs">
            <p className="text-xs font-bold text-green-700 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aprobados (Visibles)
            </p>
            <p className="text-2xl sm:text-3xl font-black text-green-700 mt-1">{approvedCount}</p>
            <p className="text-[11px] text-green-600 mt-0.5">Activos en directorio</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <p className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Por Aprobar
            </p>
            <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">{pendingApprovalCount}</p>
            <p className="text-[11px] text-amber-600 mt-0.5">Ocultos del público</p>
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
                <option value="all">Todas las aprobaciones</option>
                <option value="approved">✓ Solo Aprobados (Visibles)</option>
                <option value="pending">⏳ Solo Pendientes (Ocultos)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full md:w-44 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="all">Todos los estatus</option>
                <option value="verified">Insignia Verificada</option>
                <option value="registered">Solo Registrados</option>
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
                      <th className="py-3.5 px-4">Oficio / Nivel</th>
                      <th className="py-3.5 px-4">Ubicación / Zibatá</th>
                      <th className="py-3.5 px-4">WhatsApp</th>
                      <th className="py-3.5 px-4 text-center">Aprobado (Directorio)</th>
                      <th className="py-3.5 px-4 text-center">Verificación</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaestros.map((m) => {
                      const distKm = distanceFromZibata(m.lat, m.lng);
                      const isZibataLocal = coversZibata(m.lat, m.lng, m.radioKm || 15);
                      const isApproved = m.aprobado === true;
                      const isVerified = m.verificado === true || m.verificationStatus === 'verified';

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={m.fotoUrl || m.profilePhoto || 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=150&q=80'}
                                alt={m.nombre}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <p className="font-bold text-slate-900 text-xs sm:text-sm">{m.nombre}</p>
                                <p className="text-[11px] text-slate-500">ID: {m.id.substring(0, 10)}...</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800">
                              {m.oficio}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1">{m.nivel || 'Especialista'} • ★ {m.calificacion || 5.0}</p>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1 font-semibold text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{distKm} km de Zibatá</span>
                            </div>
                            <span className={`text-[10px] font-bold ${isZibataLocal ? 'text-green-700' : 'text-slate-500'}`}>
                              {isZibataLocal ? '✓ Cubre Zibatá' : `Radio: ${m.radioKm || 15} km`}
                            </span>
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

                          {/* Approval Switch */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => adminApproveMaestro(m.id, !isApproved)}
                              className={`py-1.5 px-3 rounded-full text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                isApproved
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              }`}
                              title={isApproved ? 'Clic para ocultar del público' : 'Clic para publicar en el directorio'}
                            >
                              {isApproved ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Aprobado (Visible)</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Pendiente (Oculto)</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Verification Switch */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => adminVerifyMaestro(m.id, !isVerified)}
                              className={`py-1.5 px-3 rounded-full text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                isVerified
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Alternar verificación oficial"
                            >
                              {isVerified ? (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                                  <span>Verificado</span>
                                </>
                              ) : (
                                <span>Registrado</span>
                              )}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenReview(m)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="Revisar expediente y documentos"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingMaestroId(m.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
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
                <img
                  src={reviewingMaestro.fotoUrl || reviewingMaestro.profilePhoto || ''}
                  alt={reviewingMaestro.nombre}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
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
              <p className="text-xs font-bold uppercase text-slate-700">Señales de Verificación Manual:</p>
              
              <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkPhone}
                  onChange={(e) => setCheckPhone(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <span>✓ Teléfono y WhatsApp comprobados (+52 celular)</span>
              </label>

              <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkPhotos}
                  onChange={(e) => setCheckPhotos(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <span>✓ Fotografías de trabajos revisadas ({reviewingMaestro.workPhotos?.length || 0} disponibles)</span>
              </label>

              <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkId}
                  onChange={(e) => setCheckId(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <span>✓ Identificación oficial (INE) en expediente privado</span>
              </label>

              <label className="flex items-center gap-3 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkRefs}
                  onChange={(e) => setCheckRefs(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <span>✓ Referencias comerciales en Zibatá / Querétaro</span>
              </label>
            </div>

            {/* Zero-Leak Sensitive Verification Dossier (INE / Identification Documents) */}
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
                  <span>Obteniendo documento de identificación seguro mediante blob efímero...</span>
                </div>
              ) : transientDoc ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-300 font-medium">
                    Documento de identificación cargado de forma segura en memoria de sesión:
                  </p>
                  {transientDoc.contentType.startsWith('image/') ? (
                    <div className="rounded-xl overflow-hidden border border-slate-700 max-h-56 bg-black flex items-center justify-center">
                      <img
                        src={transientDoc.blobUrl}
                        alt="Identificación Oficial (INE)"
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

            {/* Action buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleSaveVerification('registered')}
                className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Guardar sin insignia verificada
              </button>

              <button
                type="button"
                onClick={() => handleSaveVerification('verified')}
                className="py-2.5 px-5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-green-200" />
                <span>Marcar como "Verificado por Maestro Cerca"</span>
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
              <h4 className="text-base font-bold text-slate-900">¿Eliminar este perfil?</h4>
              <p className="text-xs text-slate-500">
                Esta acción eliminará permanentemente al maestro de la colección de Firestore.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMaestroId(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </AdminGuard>
  );
};
