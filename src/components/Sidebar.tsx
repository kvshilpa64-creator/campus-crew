import {
  Activity,
  AlertTriangle,
  Boxes,
  GitBranch,
  History,
  LayoutDashboard,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AppModuleId } from '../types/campus';

interface SidebarProps {
  activeModule: AppModuleId;
  onSelectModule: (mod: AppModuleId) => void;
  activeIncidentsCount: number;
  systemHealthScore: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onResetDemoData: () => void;
}

const NAV_ITEMS: { id: AppModuleId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'resources', label: 'Resource Management', icon: Boxes },
  { id: 'dependencies', label: 'Dependency Mapping', icon: GitBranch },
  { id: 'simulator', label: 'Failure Simulator', icon: AlertTriangle },
  { id: 'impact', label: 'Impact Analyzer', icon: Activity },
  { id: 'recovery', label: 'Recovery Planner', icon: ShieldCheck },
  { id: 'history', label: 'Incident History', icon: History },
];

export function Sidebar({
  activeModule,
  onSelectModule,
  activeIncidentsCount,
  systemHealthScore,
  mobileOpen,
  onCloseMobile,
  onResetDemoData,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full bg-[#081224] border-r border-[#1A2D4F] text-slate-200 select-none">
      {/* Brand Lockup */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-[#1A2D4F]">
        <div className="min-w-0">
          <div className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            OMNIS-X
          </div>
          <div className="text-xs text-slate-400 truncate">
            Campus Crew Digital Twin
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-[#10203D] focus-visible:outline-2 focus-visible:outline-blue-500"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          const showIncidentCount =
            (item.id === 'impact' || item.id === 'recovery') && activeIncidentsCount > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectModule(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-500 ${
                isActive
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-[#0F1F3A] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {showIncidentCount && (
                <span className="font-mono text-xs tabular-nums text-rose-400 font-semibold ml-2">
                  {activeIncidentsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Campus Twin Summary & Reset Action */}
      <div className="px-4 py-4 border-t border-[#1A2D4F] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Campus Integrity</span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              systemHealthScore >= 94
                ? 'text-emerald-400'
                : systemHealthScore >= 72
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {systemHealthScore}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#0F1F3A] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              systemHealthScore >= 94
                ? 'bg-emerald-500'
                : systemHealthScore >= 72
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${systemHealthScore}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onResetDemoData}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-[#0E1B33] hover:bg-[#142646] border border-[#1E3358] rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset Demo Data</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
}
