import { useState } from 'react';
import { Check, CheckCircle2, Play, RotateCcw, X } from 'lucide-react';
import { AppModuleId, CampusState } from '../types/campus';
import { StatusLabel } from './StatusLabel';

interface RecoveryPlannerViewProps {
  state: CampusState;
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
  onApplyRecovery: (incidentId: string, operationId: string, optionId: string) => void;
  onResolveIncident: (incidentId: string) => void;
  onNavigate: (mod: AppModuleId) => void;
}

export function RecoveryPlannerView({
  state,
  selectedIncidentId,
  onSelectIncident,
  onApplyRecovery,
  onResolveIncident,
  onNavigate,
}: RecoveryPlannerViewProps) {
  const [showInfeasibleMap, setShowInfeasibleMap] = useState<Record<string, boolean>>({});

  const incident =
    state.incidents.find((i) => i.id === selectedIncidentId) ??
    state.incidents.find((i) => i.status !== 'Resolved') ??
    state.incidents[0] ??
    null;

  if (!incident) {
    return (
      <div className="bg-white border border-sky-200/80 rounded-xl p-10 text-center space-y-4 shadow-xs">
        <div className="text-base font-semibold text-slate-900">No Active Incidents to Plan</div>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          All campus operations are currently running smoothly. Trigger a scenario in the Failure Simulator to evaluate feasible and non-feasible recovery options.
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

  const mitigatedCount = incident.affectedOperations.filter((op) => op.appliedRecovery).length;
  const allMitigated =
    incident.affectedOperations.length > 0 &&
    mitigatedCount === incident.affectedOperations.length;

  const toggleShowInfeasible = (opId: string) => {
    setShowInfeasibleMap((prev) => ({ ...prev, [opId]: !(prev[opId] ?? true) }));
  };

  return (
    <div className="space-y-6">
      {/* Top Control Header */}
      <div className="bg-white border border-sky-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="recovery-inc-select" className="text-xs font-medium text-slate-600">
            Active Incident:
          </label>
          <select
            id="recovery-inc-select"
            value={incident.id}
            onChange={(e) => onSelectIncident(e.target.value)}
            className="px-3 py-2 text-xs bg-sky-50/50 border border-sky-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500 max-w-md"
          >
            {state.incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} — {inc.title} ({inc.status})
              </option>
            ))}
          </select>
          <StatusLabel status={incident.status} />
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {mitigatedCount}/{incident.affectedOperations.length} operations mitigated
          </span>
        </div>

        {incident.status !== 'Resolved' && (
          <button
            type="button"
            onClick={() => onResolveIncident(incident.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              allMitigated
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Resolve Incident & Restore Resources</span>
          </button>
        )}
      </div>

      {/* Per-Operation Constraint Evaluation & Recovery Plans */}
      {incident.affectedOperations.length === 0 ? (
        <div className="bg-white border border-sky-200/80 rounded-xl p-8 text-center text-xs text-slate-500 shadow-xs">
          Zero timetable operations were impacted by this incident.
        </div>
      ) : (
        <div className="space-y-5">
          {incident.affectedOperations.map((op) => {
            const feasibleOpts = op.recoveryOptions.filter((r) => r.feasible);
            const infeasibleOpts = op.recoveryOptions.filter((r) => !r.feasible);
            const showInfeasible = showInfeasibleMap[op.id] ?? true;

            return (
              <div
                key={op.id}
                className="bg-white border border-sky-200/80 rounded-xl overflow-hidden shadow-xs"
              >
                {/* Operation Header */}
                <div className="px-5 py-4 border-b border-sky-100 bg-sky-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="font-mono text-sky-700 font-semibold">
                        {op.courseCode} · {op.day} {op.timeSlot}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-700 font-medium">{op.sessionType}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-600 tabular-nums">{op.batchName}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{op.courseName}</h3>
                    <div className="text-xs text-rose-700">{op.impactReason}</div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-xs">
                      <div className="text-slate-500">Evaluated Options</div>
                      <div className="font-mono tabular-nums text-slate-900 font-medium">
                        <span className="text-emerald-700">{feasibleOpts.length} feasible</span>
                        {' · '}
                        <span className="text-rose-700">{infeasibleOpts.length} rejected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Applied Recovery Banner OR Candidate List */}
                {op.appliedRecovery ? (
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50/60">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <div className="text-xs font-semibold text-emerald-900">
                          Recovery Applied: {op.appliedRecovery.title}
                        </div>
                        <p className="text-xs text-slate-700 mt-1">{op.appliedRecovery.summary}</p>
                        <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                          Applied at {new Date(op.appliedRecovery.appliedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-5">
                    {/* Feasible Options */}
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-emerald-700">
                        Feasible Recovery Recommendations ({feasibleOpts.length})
                      </div>

                      {feasibleOpts.length === 0 ? (
                        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                          No automated recovery option satisfies all capacity, equipment, and timetable constraints for this session. Inspect the rejected options below to see the exact constraint blockers.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {feasibleOpts.map((opt) => (
                            <div
                              key={opt.id}
                              className="p-4 rounded-lg bg-sky-50/40 border border-emerald-300 flex flex-col justify-between gap-3"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      {opt.title}
                                    </div>
                                    <div className="text-[11px] text-slate-600 mt-0.5">
                                      {opt.subtitle}
                                    </div>
                                  </div>
                                  <StatusLabel status="Feasible" />
                                </div>

                                <div className="space-y-1 pt-2 border-t border-sky-200/70">
                                  {opt.checks.map((chk, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2 text-[11px] text-slate-700"
                                    >
                                      <Check
                                        className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5"
                                        aria-hidden="true"
                                      />
                                      <span>
                                        <strong className="text-slate-900">{chk.label}:</strong>{' '}
                                        {chk.detail}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={incident.status === 'Resolved'}
                                onClick={() => onApplyRecovery(incident.id, op.id, opt.id)}
                                className="w-full px-3.5 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                Apply Recovery Plan
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Non-Feasible Options (Explicitly Explained) */}
                    {infeasibleOpts.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-sky-100">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-700">
                            Evaluated Alternatives Marked Not Feasible ({infeasibleOpts.length})
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleShowInfeasible(op.id)}
                            className="text-xs font-medium text-sky-600 hover:text-sky-700"
                          >
                            {showInfeasible ? 'Hide Details' : 'Show Why Rejected'}
                          </button>
                        </div>

                        {showInfeasible && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {infeasibleOpts.map((opt) => (
                              <div
                                key={opt.id}
                                className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-medium text-slate-900">
                                      {opt.title}
                                    </div>
                                    <div className="text-[11px] text-slate-500">{opt.subtitle}</div>
                                  </div>
                                  <StatusLabel status="Not Feasible" />
                                </div>

                                <div className="space-y-1 pt-2 border-t border-slate-200">
                                  {opt.checks.map((chk, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex items-start gap-2 text-[11px] ${
                                        chk.passed ? 'text-slate-600' : 'text-rose-700'
                                      }`}
                                    >
                                      {chk.passed ? (
                                        <Check
                                          className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <X
                                          className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5"
                                          aria-hidden="true"
                                        />
                                      )}
                                      <span>
                                        <strong>{chk.label}:</strong> {chk.detail}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
