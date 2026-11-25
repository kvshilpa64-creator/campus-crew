import { useEffect, useMemo, useState } from 'react';
import { Menu, Play } from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { DependencyMappingView } from './components/DependencyMappingView';
import { FailureSimulatorView } from './components/FailureSimulatorView';
import { ImpactAnalyzerView } from './components/ImpactAnalyzerView';
import { IncidentHistoryView } from './components/IncidentHistoryView';
import { RecoveryPlannerView } from './components/RecoveryPlannerView';
import { ResourceManagementView } from './components/ResourceManagementView';
import { Sidebar } from './components/Sidebar';
import {
  SimulationRequest,
  applyRecoveryPlan,
  computeSystemHealth,
  resolveAndRestoreIncident,
  simulateFailure,
} from './engine/simulationEngine';
import {
  AppModuleId,
  CampusState,
  FailureScenarioType,
  ResourceCategory,
} from './types/campus';
import { loadCampusState, resetCampusState, saveCampusState } from './utils/storage';

const MODULE_META: Record<AppModuleId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Campus Operations Dashboard',
    subtitle: 'Live digital twin readiness across academic blocks, labs, faculty, and transit',
  },
  resources: {
    title: 'Resource Management',
    subtitle: 'Add, edit, and monitor classrooms, laboratories, faculty, buses, and equipment',
  },
  dependencies: {
    title: 'Dependency Mapping',
    subtitle: 'Interactive graph and timetable matrix linking faculty, rooms, courses, and student cohorts',
  },
  simulator: {
    title: 'Failure Simulator',
    subtitle: 'Trigger operational disruptions to test cascading blast radius and mitigation paths',
  },
  impact: {
    title: 'Impact Analyzer',
    subtitle: 'Multi-tier cascading impact chain across infrastructure, classes, and campus operations',
  },
  recovery: {
    title: 'Recovery Planner',
    subtitle: 'Constraint-verified relocation, faculty substitution, and rescheduling recommendations',
  },
  history: {
    title: 'Incident History',
    subtitle: 'Persistent audit ledger of simulated failures, impacts, and applied recovery actions',
  },
};

export default function App() {
  const [state, setState] = useState<CampusState>(() => loadCampusState());
  const [activeModule, setActiveModule] = useState<AppModuleId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [preselectedScenario, setPreselectedScenario] = useState<{
    scenarioType: FailureScenarioType;
    targetId: string;
  } | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  useEffect(() => {
    saveCampusState(state);
  }, [state]);

  useEffect(() => {
    if (!bannerMessage) return;
    const timer = window.setTimeout(() => setBannerMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  const health = useMemo(() => computeSystemHealth(state), [state]);

  const handleRunSimulation = (req: SimulationRequest) => {
    const { incident, nextState } = simulateFailure(req, state);
    setState(nextState);
    setSelectedIncidentId(incident.id);
    setActiveModule('impact');
    setBannerMessage(
      `Simulated ${incident.title} — ${incident.affectedClassesCount} classes and ${incident.affectedStudentsCount} students impacted.`
    );
  };

  const handleSimulateResourceFailure = (category: ResourceCategory, resourceId: string) => {
    const scenarioMap: Record<ResourceCategory, FailureScenarioType> = {
      classroom: 'classroom_unavailable',
      lab: 'lab_unavailable',
      faculty: 'faculty_absent',
      bus: 'bus_breakdown',
      equipment: 'power_internet_failure',
    };
    setPreselectedScenario({
      scenarioType: scenarioMap[category],
      targetId: category === 'equipment' ? 'BLK-B' : resourceId,
    });
    setActiveModule('simulator');
  };

  const handleApplyRecovery = (incidentId: string, operationId: string, optionId: string) => {
    setState((prev) => applyRecoveryPlan(incidentId, operationId, optionId, prev));
    setBannerMessage('Recovery plan applied and campus timetable updated.');
  };

  const handleResolveIncident = (incidentId: string) => {
    setState((prev) => resolveAndRestoreIncident(incidentId, prev));
    setBannerMessage('Incident resolved and affected campus resources restored to Operational.');
  };

  const handleClearResolved = () => {
    setState((prev) => ({
      ...prev,
      incidents: prev.incidents.filter((i) => i.status !== 'Resolved'),
    }));
    setBannerMessage('Cleared resolved entries from incident history.');
  };

  const handleResetDemoData = () => {
    const fresh = resetCampusState();
    setState(fresh);
    setSelectedIncidentId(null);
    setPreselectedScenario(null);
    setActiveModule('dashboard');
    setBannerMessage('Campus digital twin restored to initial baseline dataset.');
  };

  const handleInspectIncident = (incidentId: string, targetMod: 'impact' | 'recovery') => {
    setSelectedIncidentId(incidentId);
    setActiveModule(targetMod);
  };

  const meta = MODULE_META[activeModule];

  return (
    <div className="min-h-screen bg-[#F4F9FF] text-slate-900 flex">
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        activeIncidentsCount={health.activeIncidentsCount}
        systemHealthScore={health.healthScore}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onResetDemoData={handleResetDemoData}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb/Title on left, 1 Primary CTA on right */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-sky-200/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="whitespace-nowrap font-medium text-slate-600">OMNIS-X</span>
                <span aria-hidden="true">/</span>
                <span className="text-sky-700 font-semibold truncate">{meta.title}</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block truncate mt-0.5">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {activeModule !== 'simulator' ? (
              <button
                type="button"
                onClick={() => setActiveModule('simulator')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Simulate Failure</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveModule('dashboard')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Back to Dashboard</span>
              </button>
            )}
          </div>
        </header>

        {/* Inline Action Confirmation Banner */}
        {bannerMessage && (
          <div className="bg-sky-50 border-b border-sky-200 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4 text-xs text-sky-900">
            <span>{bannerMessage}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-sky-700 hover:text-sky-950 font-medium shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Workspace Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeModule === 'dashboard' && (
            <DashboardView
              state={state}
              health={health}
              onNavigate={setActiveModule}
              onInspectIncident={handleInspectIncident}
            />
          )}

          {activeModule === 'resources' && (
            <ResourceManagementView
              state={state}
              onUpdateState={setState}
              onSimulateResourceFailure={handleSimulateResourceFailure}
            />
          )}

          {activeModule === 'dependencies' && (
            <DependencyMappingView
              state={state}
              onSimulateResourceFailure={handleSimulateResourceFailure}
            />
          )}

          {activeModule === 'simulator' && (
            <FailureSimulatorView
              state={state}
              preselectedScenario={preselectedScenario}
              onRunSimulation={handleRunSimulation}
            />
          )}

          {activeModule === 'impact' && (
            <ImpactAnalyzerView
              state={state}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={setSelectedIncidentId}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === 'recovery' && (
            <RecoveryPlannerView
              state={state}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={setSelectedIncidentId}
              onApplyRecovery={handleApplyRecovery}
              onResolveIncident={handleResolveIncident}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === 'history' && (
            <IncidentHistoryView
              state={state}
              onInspectIncident={handleInspectIncident}
              onResolveIncident={handleResolveIncident}
              onClearResolved={handleClearResolved}
              onNavigate={setActiveModule}
            />
          )}
        </main>
      </div>
    </div>
  );
}
