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
      <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-10 text-center space-y-4">
        <div className="text-base font-semibold text-white">No Active Incidents to Plan</div>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          All campus operations are currently running smoothly. Trigger a scenario in the Failure Simulator to evaluate feasible and non-feasible recovery options.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('simulator')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
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
      <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="recovery-inc-select" className="text-xs font-medium text-slate-400">
            Active Incident:
          </label>
          <select
            id="recovery-inc-select"
            value={incident.id}
            onChange={(e) => onSelectIncident(e.target.value)}
            className="px-3 py-2 text-xs bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500 max-w-md"
          >
            {state.incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} — {inc.title} ({inc.status})
              </option>
            ))}
          </select>
          <StatusLabel status={incident.status} />
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {mitigatedCount}/{incident.affectedOperations.length} operations mitigated
          </span>
        </div>

        {incident.status !== 'Resolved' && (
          <button
            type="button"
            onClick={() => onResolveIncident(incident.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              allMitigated
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-[#112240] hover:bg-[#172E56] text-slate-200 border border-[#1E3358]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Resolve Incident & Restore Resources</span>
          </button>
        )}
      </div>

      {/* Per-Operation Constraint Evaluation & Recovery Plans */}
      {incident.affectedOperations.length === 0 ? (
        <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-8 text-center text-xs text-slate-400">
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
                className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl overflow-hidden"
              >
                {/* Operation Header */}
                <div className="px-5 py-4 border-b border-[#1A2D4F] bg-[#081224] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="font-mono text-blue-300 font-semibold">
                        {op.courseCode} · {op.day} {op.timeSlot}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300 font-medium">{op.sessionType}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 tabular-nums">{op.batchName}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{op.courseName}</h3>
                    <div className="text-xs text-rose-300">{op.impactReason}</div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-xs">
                      <div className="text-slate-400">Evaluated Options</div>
                      <div className="font-mono tabular-nums text-white">
                        <span className="text-emerald-400">{feasibleOpts.length} feasible</span>
                        {' · '}
                        <span className="text-rose-400">{infeasibleOpts.length} rejected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Applied Recovery Banner OR Candidate List */}
                {op.appliedRecovery ? (
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-950/20">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <div className="text-xs font-semibold text-emerald-300">
                          Recovery Applied: {op.appliedRecovery.title}
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{op.appliedRecovery.summary}</p>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                          Applied at {new Date(op.appliedRecovery.appliedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-5">
                    {/* Feasible Options */}
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-emerald-400">
                        Feasible Recovery Recommendations ({feasibleOpts.length})
                      </div>

                      {feasibleOpts.length === 0 ? (
                        <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200">
                          No automated recovery option satisfies all capacity, equipment, and timetable constraints for this session. Inspect the rejected options below to see the exact constraint blockers.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {feasibleOpts.map((opt) => (
                            <div
                              key={opt.id}
                              className="p-4 rounded-lg bg-[#081224] border border-emerald-500/30 flex flex-col justify-between gap-3"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-semibold text-white">
                                      {opt.title}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {opt.subtitle}
                                    </div>
                                  </div>
                                  <StatusLabel status="Feasible" />
                                </div>

                                <div className="space-y-1 pt-2 border-t border-[#152542]">
                                  {opt.checks.map((chk, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2 text-[11px] text-slate-300"
                                    >
                                      <Check
                                        className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"
                                        aria-hidden="true"
                                      />
                                      <span>
                                        <strong className="text-slate-200">{chk.label}:</strong>{' '}
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
                                className="w-full px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
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
                      <div className="space-y-3 pt-3 border-t border-[#152542]">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-300">
                            Evaluated Alternatives Marked Not Feasible ({infeasibleOpts.length})
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleShowInfeasible(op.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            {showInfeasible ? 'Hide Details' : 'Show Why Rejected'}
                          </button>
                        </div>

                        {showInfeasible && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {infeasibleOpts.map((opt) => (
                              <div
                                key={opt.id}
                                className="p-3.5 rounded-lg bg-[#071020] border border-[#182B4B] space-y-2 opacity-90"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-medium text-slate-200">
                                      {opt.title}
                                    </div>
                                    <div className="text-[11px] text-slate-400">{opt.subtitle}</div>
                                  </div>
                                  <StatusLabel status="Not Feasible" />
                                </div>

                                <div className="space-y-1 pt-2 border-t border-[#152542]">
                                  {opt.checks.map((chk, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex items-start gap-2 text-[11px] ${
                                        chk.passed ? 'text-slate-400' : 'text-rose-300'
                                      }`}
                                    >
                                      {chk.passed ? (
                                        <Check
                                          className="w-3.5 h-3.5 text-emerald-500/80 shrink-0 mt-0.5"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <X
                                          className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5"
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
