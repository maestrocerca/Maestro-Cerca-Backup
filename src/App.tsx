import React from 'react';
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

const MainContent: React.FC = () => {
  const { currentView } = useStore();

  const renderView = () => {
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
