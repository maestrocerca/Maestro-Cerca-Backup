import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { SearchResultsView } from './components/SearchResultsView';
import { WorkerProfileView } from './components/WorkerProfileView';
import { WorkerRegisterView } from './components/WorkerRegisterView';
import { WorkerLoginView } from './components/WorkerLoginView';
import { WorkerDashboardView } from './components/WorkerDashboardView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { PrivacyNoticeView } from './components/PrivacyNoticeView';

const ToastNotification: React.FC = () => {
  const { toastMessage, clearToast } = useStore();
  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{toastMessage}</span>
      </div>
      <button
        type="button"
        onClick={clearToast}
        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        aria-label="Cerrar notificación"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const MainContent: React.FC = () => {
  const { currentView, isAdmin, firebaseUser, currentWorker, navigateTo } = useStore();

  // Strict role separation & routing priority:
  // 1. If user is administrator, they MUST NEVER access worker registration, worker login, or worker dashboard.
  // 2. If user is authenticated in Firebase but does NOT have a completed worker profile, they MUST NOT access dashboard.
  React.useEffect(() => {
    if (isAdmin && (currentView.type === 'register' || currentView.type === 'login' || currentView.type === 'dashboard')) {
      navigateTo({ type: 'admin' });
      return;
    }
    if (!isAdmin && firebaseUser && !currentWorker && currentView.type === 'dashboard') {
      navigateTo({ type: 'register' });
    }
  }, [isAdmin, firebaseUser, currentWorker, currentView.type, navigateTo]);

  const renderView = () => {
    // Top Priority: Admins never see worker onboarding, register, or dashboard
    if (isAdmin && (currentView.type === 'register' || currentView.type === 'login' || currentView.type === 'dashboard')) {
      return <AdminDashboardView />;
    }

    switch (currentView.type) {
      case 'home':
        return <HomeView />;
      case 'search':
        return (
          <SearchResultsView
            initialTrade={currentView.trade}
            initialArea={currentView.area}
            initialVerifiedOnly={currentView.verifiedOnly}
          />
        );
      case 'profile':
        return <WorkerProfileView workerSlug={currentView.workerSlug} />;
      case 'register':
        return <WorkerRegisterView />;
      case 'login':
        return <WorkerLoginView />;
      case 'dashboard':
        if (!currentWorker) {
          return <WorkerRegisterView />;
        }
        return <WorkerDashboardView />;
      case 'admin':
        return <AdminDashboardView />;
      case 'privacy':
        return <PrivacyNoticeView />;
      default:
        return <HomeView />;
    }
  };

  // Scroll to top on view changes
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-slate-800 font-sans selection:bg-orange-100 selection:text-orange-900">
      <Navbar />
      <div className="flex-1">
        {renderView()}
      </div>
      <Footer />
      <ToastNotification />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainContent />
    </StoreProvider>
  );
}
