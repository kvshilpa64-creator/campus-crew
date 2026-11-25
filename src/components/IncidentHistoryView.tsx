import { useMemo, useState } from 'react';
import { Download, Play, Search, Trash2 } from 'lucide-react';
import { AppModuleId, CampusState, IncidentRecord } from '../types/campus';
import { StatusLabel } from './StatusLabel';

interface IncidentHistoryViewProps {
  state: CampusState;
  onInspectIncident: (incidentId: string, targetMod: 'impact' | 'recovery') => void;
  onResolveIncident: (incidentId: string) => void;
  onClearResolved: () => void;
  onNavigate: (mod: AppModuleId) => void;
}

export function IncidentHistoryView({
  state,
  onInspectIncident,
  onResolveIncident,
  onClearResolved,
  onNavigate,
}: IncidentHistoryViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentRecord['status']>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(state.incidents[0]?.id ?? null);

  const filtered = useMemo(() => {
    return state.incidents.filter((inc) => {
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inc.id.toLowerCase().includes(q) ||
          inc.title.toLowerCase().includes(q) ||
          inc.targetName.toLowerCase().includes(q) ||
          inc.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.incidents, statusFilter, searchQuery]);

  const activeDetail =
    filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state.incidents, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnisx-incident-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state.incidents.length === 0) {
    return (
      <div className="bg-white border border-sky-200/80 rounded-xl p-10 text-center space-y-4 shadow-xs">
        <div className="text-base font-semibold text-slate-900">
          Incident History Ledger is Empty
        </div>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Every failure simulation, cascading impact snapshot, and applied recovery action is automatically persisted in localStorage and archived here.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('simulator')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Run First Simulation</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-sky-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incident ID, scenario, or notes..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-sky-50/50 border border-sky-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | IncidentRecord['status'])}
            aria-label="Filter incidents by status"
            className="px-3 py-2 text-xs bg-sky-50/50 border border-sky-200 rounded-lg text-slate-800 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Statuses ({state.incidents.length})</option>
            <option value="Active">Active</option>
            <option value="Partially Mitigated">Partially Mitigated</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
            <span>Export JSON</span>
          </button>
          {state.incidents.some((i) => i.status === 'Resolved') && (
            <button
              type="button"
              onClick={onClearResolved}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Resolved</span>
            </button>
          )}
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6 bg-white border border-sky-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="divide-y divide-sky-100">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No incidents match your filter.
              </div>
            ) : (
              filtered.map((inc) => {
                const isSelected = activeDetail?.id === inc.id;
                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => setSelectedId(inc.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      isSelected ? 'bg-sky-50' : 'hover:bg-sky-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-sky-700 font-semibold">{inc.id}</span>
                      <StatusLabel status={inc.status} />
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">{inc.title}</div>
                    <div className="text-xs text-slate-500 mt-1 tabular-nums">
                      {inc.affectedClassesCount} classes · {inc.affectedStudentsCount} students ·{' '}
                      {new Date(inc.triggeredAt).toLocaleString()}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-sky-200/80 rounded-xl p-5 space-y-5 shadow-xs">
          {activeDetail ? (
            <>
              <div className="border-b border-sky-100 pb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{activeDetail.id}</span>
                  <StatusLabel status={activeDetail.status} />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{activeDetail.title}</h3>
                <p className="text-xs text-slate-700">{activeDetail.notes}</p>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Triggered: {new Date(activeDetail.triggeredAt).toLocaleString()}
                  {activeDetail.resolvedAt
                    ? ` · Resolved: ${new Date(activeDetail.resolvedAt).toLocaleString()}`
                    : ''}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Impacted Operations & Recovery Actions
                </div>
                {activeDetail.affectedOperations.length === 0 ? (
                  <p className="text-xs text-slate-500">No classes disrupted.</p>
                ) : (
                  <div className="space-y-2">
                    {activeDetail.affectedOperations.map((op) => (
                      <div
                        key={op.id}
                        className="p-3 rounded-lg bg-sky-50/60 border border-sky-200/70 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sky-700 font-semibold">
                            {op.courseCode} · {op.day} {op.timeSlot}
                          </span>
                          <span
                            className={
                              op.appliedRecovery
                                ? 'text-emerald-700 font-medium'
                                : 'text-amber-700 font-medium'
                            }
                          >
                            {op.appliedRecovery ? 'Mitigated' : 'Unmitigated'}
                          </span>
                        </div>
                        <div className="text-slate-900 font-medium">{op.batchName}</div>
                        <div className="text-slate-600">
                          {op.appliedRecovery
                            ? `Action: ${op.appliedRecovery.title}`
                            : op.impactReason}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Audit Action Log</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeDetail.actionLog.map((entry, idx) => (
                    <div key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-slate-700">{entry.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-sky-100 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onInspectIncident(activeDetail.id, 'impact')}
                  className="px-3 py-2 text-xs font-medium text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors"
                >
                  View Impact Chain
                </button>
                <button
                  type="button"
                  onClick={() => onInspectIncident(activeDetail.id, 'recovery')}
                  className="px-3 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
                >
                  Open Recovery Planner
                </button>
                {activeDetail.status !== 'Resolved' && (
                  <button
                    type="button"
                    onClick={() => onResolveIncident(activeDetail.id)}
                    className="px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    Resolve & Restore
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
