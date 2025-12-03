import React from 'react';
import { MessageSquare, Database, Menu, X } from 'lucide-react';
import { AppView } from '../types';

interface LayoutProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onChangeView, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => (
    <button
      onClick={() => {
        onChangeView(view);
        setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        currentView === view
          ? 'bg-blue-800 text-white shadow-md'
          : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-[#003366] text-white flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-blue-800/50">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                {/* Simplified Komdigi Logo representation */}
                <div className="w-4 h-4 bg-blue-600 rounded-full" />
             </div>
             <span className="font-bold tracking-tight">SDM KOMDIGI</span>
           </div>
           <button 
             className="ml-auto md:hidden text-blue-200"
             onClick={() => setIsSidebarOpen(false)}
           >
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Top Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem view={AppView.CHAT} icon={MessageSquare} label="Layanan Tanya Jawab" />
        </nav>

        {/* Bottom Navigation */}
        <div className="px-4 pb-2">
           <NavItem view={AppView.KNOWLEDGE} icon={Database} label="Log" />
        </div>

        <div className="p-4 border-t border-blue-800/50 text-xs text-blue-300 text-center">
          &copy; 2024 Biro SDM & Organisasi<br/>Kementerian Komdigi
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-4 font-semibold text-gray-800">Layanan SDM</span>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    </div>
  );
};