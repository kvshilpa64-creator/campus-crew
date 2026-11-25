import { ArrowRight, ChevronRight, Play, ShieldCheck } from 'lucide-react';
import { AppModuleId, CampusState } from '../types/campus';
import { StatusLabel } from './StatusLabel';

interface ImpactAnalyzerViewProps {
  state: CampusState;
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
  onNavigate: (mod: AppModuleId) => void;
}

export function ImpactAnalyzerView({
  state,
  selectedIncidentId,
  onSelectIncident,
  onNavigate,
}: ImpactAnalyzerViewProps) {
  const activeOrLatest =
    state.incidents.find((i) => i.id === selectedIncidentId) ??
    state.incidents.find((i) => i.status !== 'Resolved') ??
    state.incidents[0] ??
    null;

  if (!activeOrLatest) {
    return (
      <div className="bg-white border border-sky-200/80 rounded-xl p-10 text-center space-y-4 shadow-xs">
        <div className="text-base font-semibold text-slate-900">
          No Incident Selected for Impact Analysis
        </div>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Trigger a failure scenario in the Failure Simulator to trace cascading effects across classrooms, labs, faculty, student cohorts, and connected campus operations.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('simulator')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Open Failure Simulator</span>
        </button>
      </div>
    );
  }

  const uniqueConnectedOps = Array.from(
    new Set(activeOrLatest.affectedOperations.flatMap((op) => op.connectedOperations))
  );

  return (
    <div className="space-y-6">
      {/* Incident Selector & Action Bar */}
      <div className="bg-white border border-sky-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <label htmlFor="impact-incident-select" className="text-xs font-medium text-slate-600">
            Incident Scope:
          </label>
          <select
            id="impact-incident-select"
            value={activeOrLatest.id}
            onChange={(e) => onSelectIncident(e.target.value)}
            className="px-3 py-2 text-xs bg-sky-50/50 border border-sky-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500 max-w-md"
          >
            {state.incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} — {inc.title} ({inc.status})
              </option>
            ))}
          </select>
          <StatusLabel status={activeOrLatest.status} />
        </div>

        <button
          type="button"
          onClick={() => onNavigate('recovery')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Open Recovery Planner</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Summary Impact Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-sky-200/80 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">Affected Classes</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {activeOrLatest.affectedClassesCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">Scheduled sessions disrupted</div>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">Affected Students</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {activeOrLatest.affectedStudentsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">Across impacted cohorts</div>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">Compromised Resources</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {activeOrLatest.affectedResources.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {activeOrLatest.affectedFacultyCount} faculty affected
          </div>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">Connected Operations</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {uniqueConnectedOps.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Downstream milestones at risk</div>
        </div>
      </div>

      {/* Visual Cascading Impact Chain */}
      <div className="bg-white border border-sky-200/80 rounded-xl p-5 space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Visual Cascading Impact Chain</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Four-tier propagation from root trigger through campus infrastructure to student cohorts
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-stretch">
          {activeOrLatest.cascadingChain.map((tier, idx) => (
            <div key={tier.tier} className="relative flex flex-col">
              <div className="flex-1 bg-sky-50/50 border border-sky-200/80 rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-sky-200/70 mb-3">
                  <span className="text-xs font-semibold text-sky-900">
                    Tier {tier.tier} · {tier.label}
                  </span>
                  {idx < activeOrLatest.cascadingChain.length - 1 && (
                    <ChevronRight
                      className="w-4 h-4 text-sky-500 hidden xl:block"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="space-y-2.5 flex-1">
                  {tier.items.map((item) => {
                    const sevColor =
                      item.severity === 'Critical'
                        ? 'text-rose-700'
                        : item.severity === 'High'
                        ? 'text-amber-700'
                        : item.severity === 'Medium'
                        ? 'text-sky-700'
                        : 'text-slate-500';

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-white border border-sky-200/70 space-y-1 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-medium text-slate-900 leading-snug">
                            {item.title}
                          </div>
                          <span className={`text-[11px] font-semibold shrink-0 ${sevColor}`}>
                            {item.severity}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 leading-snug">
                          {item.subtitle}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Affected Operations Detail Table */}
      <div className="bg-white border border-sky-200/80 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-sky-100 bg-sky-50/40 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Affected Operations & Connected Dependencies
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeOrLatest.notes}
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {activeOrLatest.affectedOperations.length} operations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-sky-200/80 bg-sky-50/70 text-xs font-medium text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">Class & Slot</th>
                <th className="py-3 px-4 whitespace-nowrap">Cohort</th>
                <th className="py-3 px-4 whitespace-nowrap">Faculty & Room</th>
                <th className="py-3 px-4 whitespace-nowrap">Impact Reason</th>
                <th className="py-3 px-4 whitespace-nowrap">Connected Operations</th>
                <th className="py-3 px-4 whitespace-nowrap">Mitigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs">
              {activeOrLatest.affectedOperations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No scheduled classes were impacted by this scenario window.
                  </td>
                </tr>
              ) : (
                activeOrLatest.affectedOperations.map((op) => (
                  <tr key={op.id} className="hover:bg-sky-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-sky-700 font-semibold whitespace-nowrap">
                        {op.courseCode} · {op.day} {op.timeSlot}
                      </div>
                      <div className="text-slate-900 font-medium">{op.courseName}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 tabular-nums">
                      {op.batchName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-slate-900">{op.facultyName}</div>
                      <div className="text-slate-500">{op.originalRoomName}</div>
                    </td>
                    <td className="py-3 px-4 text-rose-700 max-w-xs">{op.impactReason}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">
                      {op.connectedOperations.join(' · ') || 'None'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {op.appliedRecovery ? (
                        <StatusLabel status="Resolved" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigate('recovery')}
                          className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded transition-colors"
                        >
                          Plan Recovery
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
