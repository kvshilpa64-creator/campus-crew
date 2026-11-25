import { useState } from 'react';
import { ArrowRight, CheckCircle2, Play, ShieldAlert } from 'lucide-react';
import { DAYS_OF_WEEK } from '../data/sampleCampusData';
import { SystemHealthMetrics } from '../engine/simulationEngine';
import { AppModuleId, CampusState } from '../types/campus';
import { StatusLabel } from './StatusLabel';

interface DashboardViewProps {
  state: CampusState;
  health: SystemHealthMetrics;
  onNavigate: (mod: AppModuleId) => void;
  onInspectIncident: (incidentId: string, targetMod: 'impact' | 'recovery') => void;
}

export function DashboardView({
  state,
  health,
  onNavigate,
  onInspectIncident,
}: DashboardViewProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const classrooms = state.rooms.filter((r) => r.category === 'classroom');
  const labs = state.rooms.filter((r) => r.category === 'lab');
  const opClassrooms = classrooms.filter((r) => r.status === 'Operational').length;
  const opLabs = labs.filter((r) => r.status === 'Operational').length;
  const opFaculty = state.faculty.filter((f) => f.status === 'Operational').length;

  const activeIncidents = state.incidents.filter((i) => i.status !== 'Resolved');

  const categoryBreakdown = [
    {
      label: 'Classrooms',
      operational: opClassrooms,
      maintenance: classrooms.filter((r) => r.status === 'Maintenance').length,
      unavailable: classrooms.filter((r) => r.status === 'Unavailable').length,
      total: classrooms.length,
    },
    {
      label: 'Laboratories',
      operational: opLabs,
      maintenance: labs.filter((r) => r.status === 'Maintenance').length,
      unavailable: labs.filter((r) => r.status === 'Unavailable').length,
      total: labs.length,
    },
    {
      label: 'Faculty',
      operational: opFaculty,
      maintenance: state.faculty.filter((f) => f.status === 'Maintenance').length,
      unavailable: state.faculty.filter((f) => f.status === 'Unavailable').length,
      total: state.faculty.length,
    },
    {
      label: 'Campus Buses',
      operational: state.buses.filter((b) => b.status === 'Operational').length,
      maintenance: state.buses.filter((b) => b.status === 'Maintenance').length,
      unavailable: state.buses.filter((b) => b.status === 'Unavailable').length,
      total: state.buses.length,
    },
    {
      label: 'Critical Equipment',
      operational: state.equipment.filter((e) => e.status === 'Operational').length,
      maintenance: state.equipment.filter((e) => e.status === 'Maintenance').length,
      unavailable: state.equipment.filter((e) => e.status === 'Unavailable').length,
      total: state.equipment.length,
    },
  ];

  // Weekly timetable load by day and block for chart
  const weeklyLoad = DAYS_OF_WEEK.map((day) => {
    const daySessions = state.timetable.filter((s) => s.day === day);
    const blockA = daySessions.filter(
      (s) => state.rooms.find((r) => r.id === s.roomId)?.blockId === 'BLK-A'
    ).length;
    const blockB = daySessions.filter(
      (s) => state.rooms.find((r) => r.id === s.roomId)?.blockId === 'BLK-B'
    ).length;
    const blockC = daySessions.filter(
      (s) => state.rooms.find((r) => r.id === s.roomId)?.blockId === 'BLK-C'
    ).length;
    const impacted = daySessions.filter((s) =>
      activeIncidents.some((inc) =>
        inc.affectedOperations.some((op) => op.sessionId === s.id && !op.appliedRecovery)
      )
    ).length;

    return {
      day,
      total: daySessions.length,
      blockA,
      blockB,
      blockC,
      impacted,
    };
  });

  const maxDaySessions = Math.max(6, ...weeklyLoad.map((d) => d.total));

  return (
    <div className="space-y-6">
      {/* Top 4 Primary Campus Inventory Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-sky-200/80 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Classrooms</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-slate-900 font-mono tabular-nums">
              {classrooms.length}
            </span>
            <span className="text-xs text-sky-700 font-medium tabular-nums">
              {opClassrooms} operational
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Blocks A, B & C · {classrooms.reduce((s, r) => s + r.capacity, 0)} seats
          </div>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Laboratories</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-slate-900 font-mono tabular-nums">
              {labs.length}
            </span>
            <span className="text-xs text-sky-700 font-medium tabular-nums">
              {opLabs} operational
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            OS · DDCO · DBMS · OOPS · Python
          </div>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Active Faculty</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-slate-900 font-mono tabular-nums">
              {state.faculty.length}
            </span>
            <span className="text-xs text-sky-700 font-medium tabular-nums">
              {opFaculty} available
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {state.courses.length} active courses scheduled
          </div>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Enrolled Students</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-slate-900 font-mono tabular-nums">
              {health.totalStudents}
            </span>
            <span className="text-xs text-sky-700 font-medium tabular-nums">
              {state.batches.length} cohorts
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {state.batches.reduce((s, b) => s + b.commuterCount, 0)} bus commuters tracked
          </div>
        </div>
      </div>

      {/* Operational Health & Incident Strip (3 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-sky-200/80 rounded-xl p-5 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs font-medium text-slate-500">System Health</div>
            <div className="mt-1.5 flex items-baseline gap-3">
              <span className="text-3xl font-semibold font-mono tabular-nums text-slate-900">
                {health.healthScore}%
              </span>
              <StatusLabel status={health.statusLabel} />
            </div>
            <div className="mt-2 text-xs text-slate-500 tabular-nums">
              {health.operationalResources}/{health.totalResources} resources online
            </div>
          </div>
          <svg viewBox="0 0 64 64" className="w-16 h-16 shrink-0" aria-hidden="true">
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="#E0F2FE"
              strokeWidth="6"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={
                health.healthScore >= 94
                  ? '#10B981'
                  : health.healthScore >= 72
                  ? '#F59E0B'
                  : '#EF4444'
              }
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(health.healthScore / 100) * 163.36} 163.36`}
              transform="rotate(-90 32 32)"
            />
          </svg>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Active Incidents</div>
              <div className="mt-1.5 text-3xl font-semibold font-mono tabular-nums text-slate-900">
                {health.activeIncidentsCount}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('simulator')}
              className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Run Simulation
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {state.incidents.filter((i) => i.status === 'Resolved').length} resolved in ledger
          </div>
        </div>

        <div className="bg-white border border-sky-200/80 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Affected Classes</div>
              <div className="mt-1.5 text-3xl font-semibold font-mono tabular-nums text-slate-900">
                {health.affectedClassesCount}
              </div>
            </div>
            {health.affectedClassesCount > 0 ? (
              <button
                type="button"
                onClick={() => onNavigate('recovery')}
                className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Open Planner
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('dependencies')}
                className="px-3 py-1.5 text-xs font-medium text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                View Map
              </button>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {health.affectedStudentsCount > 0
              ? `${health.affectedStudentsCount} students impacted across unmitigated sessions`
              : `All ${state.timetable.length} weekly sessions running on schedule`}
          </div>
        </div>
      </div>

      {/* Charts Section: Resource Readiness + Weekly Load */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Readiness */}
        <div className="lg:col-span-6 bg-white border border-sky-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Resource Readiness by Category
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live operational availability across all tracked campus assets
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('resources')}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 whitespace-nowrap shrink-0"
            >
              Manage Resources
            </button>
          </div>

          <div className="space-y-4">
            {categoryBreakdown.map((cat) => {
              const opPct = cat.total > 0 ? (cat.operational / cat.total) * 100 : 0;
              const maintPct = cat.total > 0 ? (cat.maintenance / cat.total) * 100 : 0;
              const unavailPct = cat.total > 0 ? (cat.unavailable / cat.total) * 100 : 0;

              return (
                <div key={cat.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{cat.label}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-slate-500">
                      <span className="text-emerald-700 font-medium">{cat.operational} ok</span>
                      {cat.maintenance > 0 && (
                        <span className="text-amber-700 font-medium">{cat.maintenance} maint</span>
                      )}
                      {cat.unavailable > 0 && (
                        <span className="text-rose-700 font-medium">{cat.unavailable} down</span>
                      )}
                      <span>/ {cat.total}</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-sky-100 rounded-sm overflow-hidden flex">
                    <div
                      className="bg-emerald-500 transition-all duration-300"
                      style={{ width: `${opPct}%` }}
                    />
                    <div
                      className="bg-amber-500 transition-all duration-300"
                      style={{ width: `${maintPct}%` }}
                    />
                    <div
                      className="bg-rose-500 transition-all duration-300"
                      style={{ width: `${unavailPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Timetable Load Bar Chart */}
        <div className="lg:col-span-6 bg-white border border-sky-200/80 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Weekly Academic Load by Campus Block
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Scheduled timetable sessions across Block A, Block B, and Block C
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-700" />
                Blk A
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500" />
                Blk B
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-300" />
                Blk C
              </span>
            </div>
          </div>

          <div className="relative pt-2">
            <div className="grid grid-cols-5 gap-4 items-end h-44 border-b border-sky-100 pb-2">
              {weeklyLoad.map((d) => {
                const aHeight = (d.blockA / maxDaySessions) * 100;
                const bHeight = (d.blockB / maxDaySessions) * 100;
                const cHeight = (d.blockC / maxDaySessions) * 100;

                return (
                  <div
                    key={d.day}
                    onMouseEnter={() => setHoveredDay(d.day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="h-full flex flex-col justify-end items-center group cursor-default"
                  >
                    <div className="text-xs font-mono tabular-nums text-slate-700 font-medium mb-1.5">
                      {d.total}
                      {d.impacted > 0 && (
                        <span className="text-rose-600 ml-1">({d.impacted}!)</span>
                      )}
                    </div>
                    <div className="w-full max-w-[46px] h-full flex flex-col justify-end gap-0.5">
                      {d.blockC > 0 && (
                        <div
                          className="w-full bg-sky-300 rounded-t-xs transition-opacity group-hover:opacity-90"
                          style={{ height: `${cHeight}%` }}
                          title={`Block C: ${d.blockC} sessions`}
                        />
                      )}
                      {d.blockB > 0 && (
                        <div
                          className="w-full bg-sky-500 transition-opacity group-hover:opacity-90"
                          style={{ height: `${bHeight}%` }}
                          title={`Block B: ${d.blockB} sessions`}
                        />
                      )}
                      {d.blockA > 0 && (
                        <div
                          className="w-full bg-sky-700 rounded-b-xs transition-opacity group-hover:opacity-90"
                          style={{ height: `${aHeight}%` }}
                          title={`Block A: ${d.blockA} sessions`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-5 gap-4 pt-2 text-center">
              {weeklyLoad.map((d) => (
                <div key={d.day} className="text-xs font-medium text-slate-600">
                  {d.day}
                </div>
              ))}
            </div>
            <div className="mt-3 h-5 text-xs text-slate-500">
              {hoveredDay ? (
                (() => {
                  const info = weeklyLoad.find((x) => x.day === hoveredDay);
                  if (!info) return null;
                  return (
                    <span className="tabular-nums text-sky-900 font-medium">
                      {info.day}: {info.total} sessions · Block A ({info.blockA}) · Block B ({info.blockB}) · Block C ({info.blockC})
                      {info.impacted > 0 ? ` · ${info.impacted} impacted` : ''}
                    </span>
                  );
                })()
              ) : (
                <span>Hover a weekday bar to inspect block-level session distribution.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Incidents / Operational Readiness Feed */}
      <div className="bg-white border border-sky-200/80 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-sky-100 bg-sky-50/40 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Active Incident Queue & Mitigation Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time operational disruptions requiring impact inspection or recovery actions
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('simulator')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Trigger Failure Simulation</span>
          </button>
        </div>

        {activeIncidents.length === 0 ? (
          <div className="px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  All campus operations nominal
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  Zero active disruptions detected across Block A, Block B, Block C, and campus transit routes. Launch a failure scenario in the simulator to test cascading impact analysis and recovery planning.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('dependencies')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>Inspect Dependency Graph</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="divide-y divide-sky-100">
            {activeIncidents.map((inc) => {
              const mitigatedCount = inc.affectedOperations.filter((o) => o.appliedRecovery).length;
              return (
                <div
                  key={inc.id}
                  className="px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-sky-50/50 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                      <span className="font-mono text-xs text-slate-500 tabular-nums">{inc.id}</span>
                      <span className="text-sm font-semibold text-slate-900">{inc.title}</span>
                      <StatusLabel status={inc.status} />
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 tabular-nums">
                      <span>{inc.affectedClassesCount} affected classes</span>
                      <span aria-hidden="true">·</span>
                      <span>{inc.affectedStudentsCount} students</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {mitigatedCount}/{inc.affectedOperations.length} operations mitigated
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Triggered {new Date(inc.triggeredAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onInspectIncident(inc.id, 'impact')}
                      className="px-3 py-1.5 text-xs font-medium text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Impact Chain
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectIncident(inc.id, 'recovery')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Recovery Planner
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
