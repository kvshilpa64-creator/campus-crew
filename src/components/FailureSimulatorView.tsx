import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  Building2,
  FlaskConical,
  Play,
  UserX,
  ZapOff,
} from 'lucide-react';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../data/sampleCampusData';
import { SimulationRequest, simulateFailure } from '../engine/simulationEngine';
import {
  CampusState,
  DayOfWeek,
  FailureScenarioType,
  PowerInternetSubtype,
  TimeSlotCode,
} from '../types/campus';

interface FailureSimulatorViewProps {
  state: CampusState;
  preselectedScenario?: {
    scenarioType: FailureScenarioType;
    targetId: string;
  } | null;
  onRunSimulation: (req: SimulationRequest) => void;
}

const SCENARIO_CARDS: {
  type: FailureScenarioType;
  label: string;
  description: string;
  icon: typeof FlaskConical;
}[] = [
  {
    type: 'lab_unavailable',
    label: 'Laboratory Unavailable',
    description: 'HVAC failure, hardware fault, or safety lockdown in a specialized lab.',
    icon: FlaskConical,
  },
  {
    type: 'faculty_absent',
    label: 'Faculty Absent',
    description: 'Unplanned medical leave or emergency absence for a teaching faculty member.',
    icon: UserX,
  },
  {
    type: 'bus_breakdown',
    label: 'Bus Breakdown',
    description: 'Transit route breakdown stranding morning commuter student cohorts.',
    icon: Bus,
  },
  {
    type: 'classroom_unavailable',
    label: 'Classroom Unavailable',
    description: 'AV failure, maintenance closure, or structural issue in a lecture hall.',
    icon: Building2,
  },
  {
    type: 'power_internet_failure',
    label: 'Internet or Power Failure',
    description: 'Substation trip or core fiber uplink failure affecting an entire block or campus.',
    icon: ZapOff,
  },
];

export function FailureSimulatorView({
  state,
  preselectedScenario,
  onRunSimulation,
}: FailureSimulatorViewProps) {
  const [scenarioType, setScenarioType] = useState<FailureScenarioType>(
    preselectedScenario?.scenarioType ?? 'lab_unavailable'
  );
  const [targetId, setTargetId] = useState<string>(
    preselectedScenario?.targetId ??
      state.rooms.find((r) => r.category === 'lab')?.id ??
      ''
  );
  const [subType, setSubType] = useState<PowerInternetSubtype>('power_and_internet');
  const [dayFilter, setDayFilter] = useState<DayOfWeek | 'ALL'>('ALL');
  const [timeSlotFilter, setTimeSlotFilter] = useState<TimeSlotCode | 'ALL'>('ALL');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (preselectedScenario) {
      setScenarioType(preselectedScenario.scenarioType);
      setTargetId(preselectedScenario.targetId);
    }
  }, [preselectedScenario]);

  const targetOptions = useMemo(() => {
    if (scenarioType === 'lab_unavailable') {
      return state.rooms
        .filter((r) => r.category === 'lab')
        .map((r) => ({ id: r.id, label: `${r.code} — ${r.name} (${r.blockId}, Cap ${r.capacity})` }));
    }
    if (scenarioType === 'classroom_unavailable') {
      return state.rooms
        .filter((r) => r.category === 'classroom')
        .map((r) => ({ id: r.id, label: `${r.code} — ${r.name} (${r.blockId}, Cap ${r.capacity})` }));
    }
    if (scenarioType === 'faculty_absent') {
      return state.faculty.map((f) => ({
        id: f.id,
        label: `${f.name} (${f.department})`,
      }));
    }
    if (scenarioType === 'bus_breakdown') {
      return state.buses.map((b) => ({
        id: b.id,
        label: `${b.code} — ${b.routeName} (${b.assignedStudentsCount} commuters)`,
      }));
    }
    return [
      { id: 'BLK-B', label: 'Block B — Engineering & Specialized Labs (Substation B)' },
      { id: 'BLK-A', label: 'Block A — Main Lecture & Computing Wing (Substation A)' },
      { id: 'BLK-C', label: 'Block C — Applied Sciences & Robotics (Substation C)' },
      { id: 'CAMPUS-WIDE', label: 'Entire Campus (All Academic Blocks & Core Fiber)' },
    ];
  }, [scenarioType, state]);

  // Keep targetId synchronized when scenarioType changes
  useEffect(() => {
    if (!targetOptions.some((opt) => opt.id === targetId)) {
      setTargetId(targetOptions[0]?.id ?? '');
    }
  }, [targetOptions, targetId]);

  // Live pre-flight blast radius estimation using simulation engine (dry run without mutating state)
  const preview = useMemo(() => {
    if (!targetId) return null;
    try {
      const { incident } = simulateFailure(
        {
          scenarioType,
          targetId,
          subType,
          dayFilter,
          timeSlotFilter,
          notes: notes || 'Dry-run simulation preview',
        },
        state
      );
      return incident;
    } catch {
      return null;
    }
  }, [scenarioType, targetId, subType, dayFilter, timeSlotFilter, notes, state]);

  const handleTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    onRunSimulation({
      scenarioType,
      targetId,
      subType,
      dayFilter,
      timeSlotFilter,
      notes: notes.trim() || `Simulated ${scenarioType.replace(/_/g, ' ')} event`,
    });
  };

  const applyPreset = (
    type: FailureScenarioType,
    id: string,
    noteText: string,
    sub: PowerInternetSubtype = 'power_and_internet',
    day: DayOfWeek | 'ALL' = 'ALL'
  ) => {
    setScenarioType(type);
    setTargetId(id);
    setSubType(sub);
    setDayFilter(day);
    setTimeSlotFilter('ALL');
    setNotes(noteText);
  };

  return (
    <div className="space-y-6">
      {/* One-Click Realistic Hackathon Demo Presets */}
      <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Quick Failure Presets</h2>
            <p className="text-xs text-slate-400">
              Load realistic campus disruption scenarios to test cascading impacts and feasibility checks
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() =>
              applyPreset(
                'lab_unavailable',
                'LAB-B1',
                'Chiller leak & GPU rack thermal shutdown in AI Lab B1'
              )
            }
            className="text-left p-3.5 rounded-lg bg-[#081224] hover:bg-[#10213E] border border-[#1A2D4F] transition-colors"
          >
            <div className="text-xs font-semibold text-blue-300">AI Lab B1 Chiller Fault</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Tests GPU cluster relocation & timetable capacity checks
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset(
                'lab_unavailable',
                'LAB-B3',
                'High-voltage bench trip in IoT & FPGA Lab B3'
              )
            }
            className="text-left p-3.5 rounded-lg bg-[#081224] hover:bg-[#10213E] border border-[#1A2D4F] transition-colors"
          >
            <div className="text-xs font-semibold text-amber-300">IoT Lab B3 Hardware Lockout</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Demonstrates why same-slot lab swaps are Not Feasible
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset(
                'power_internet_failure',
                'BLK-B',
                '400kVA Substation B transformer trip affecting Block B',
                'power_outage',
                'Mon'
              )
            }
            className="text-left p-3.5 rounded-lg bg-[#081224] hover:bg-[#10213E] border border-[#1A2D4F] transition-colors"
          >
            <div className="text-xs font-semibold text-rose-300">Block B Power Outage (Mon)</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Multi-room cascade across Block B & cross-block recovery
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset(
                'bus_breakdown',
                'BUS-01',
                'Alternator failure on Route B-01 North Express at 07:45 AM'
              )
            }
            className="text-left p-3.5 rounded-lg bg-[#081224] hover:bg-[#10213E] border border-[#1A2D4F] transition-colors"
          >
            <div className="text-xs font-semibold text-sky-300">Bus B-01 Breakdown</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Strands 48 morning commuters; evaluates reserve shuttle & hybrid shifts
            </div>
          </button>
        </div>
      </div>

      {/* Scenario Builder + Pre-Flight Blast Radius */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleTrigger}
          className="lg:col-span-7 bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-5 space-y-5"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Configure Failure Scenario</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a disruption category, target campus asset, and time window
            </p>
          </div>

          {/* 5 Scenario Category Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SCENARIO_CARDS.map((card) => {
              const Icon = card.icon;
              const selected = scenarioType === card.type;
              return (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => setScenarioType(card.type)}
                  className={`text-left p-3.5 rounded-lg border transition-colors ${
                    selected
                      ? 'bg-blue-600/15 border-blue-500 text-white'
                      : 'bg-[#081224] border-[#1A2D4F] text-slate-300 hover:border-[#2A477A]'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${selected ? 'text-blue-400' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <span>{card.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {card.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Target Resource & Scope */}
          <div className="space-y-4 pt-2 border-t border-[#1A2D4F] text-xs">
            <div>
              <label htmlFor="sim-target" className="block text-slate-300 font-medium mb-1.5">
                Target Resource / Zone
              </label>
              <select
                id="sim-target"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                {targetOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {scenarioType === 'power_internet_failure' && (
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Infrastructure Failure Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'power_outage', label: 'Power Grid Only' },
                    { id: 'internet_outage', label: 'Internet / Fiber Only' },
                    { id: 'power_and_internet', label: 'Power + Internet' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSubType(opt.id as PowerInternetSubtype)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        subType === opt.id
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-[#071020] text-slate-300 border-[#1A2D4F] hover:border-[#2A477A]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="sim-day" className="block text-slate-300 font-medium mb-1.5">
                  Day Window
                </label>
                <select
                  id="sim-day"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value as DayOfWeek | 'ALL')}
                  className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">Entire Week (Mon–Fri)</option>
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d} Only
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sim-slot" className="block text-slate-300 font-medium mb-1.5">
                  Time Slot Window
                </label>
                <select
                  id="sim-slot"
                  value={timeSlotFilter}
                  onChange={(e) => setTimeSlotFilter(e.target.value as TimeSlotCode | 'ALL')}
                  className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Daily Time Slots</option>
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="sim-notes" className="block text-slate-300 font-medium mb-1.5">
                Root Cause / Incident Notes
              </label>
              <input
                id="sim-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., HVAC coolant leak or substation breaker trip"
                className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>Run Failure Simulation</span>
            </button>
          </div>
        </form>

        {/* Live Estimated Blast Radius Preview */}
        <div className="lg:col-span-5 bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A2D4F] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Estimated Blast Radius</h3>
              <p className="text-xs text-slate-400">Live dependency preview before committing</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>

          {preview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-[#081224] border border-[#182B4B]">
                  <div className="text-xl font-semibold font-mono tabular-nums text-white">
                    {preview.affectedClassesCount}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Classes Hit</div>
                </div>
                <div className="p-3 rounded-lg bg-[#081224] border border-[#182B4B]">
                  <div className="text-xl font-semibold font-mono tabular-nums text-white">
                    {preview.affectedStudentsCount}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Students</div>
                </div>
                <div className="p-3 rounded-lg bg-[#081224] border border-[#182B4B]">
                  <div className="text-xl font-semibold font-mono tabular-nums text-white">
                    {preview.affectedResources.length}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Assets Down</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-300 mb-2">
                  Affected Sessions Preview
                </div>
                {preview.affectedOperations.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 rounded-lg bg-[#081224] border border-[#182B4B]">
                    No scheduled timetable classes fall within the selected target and time window.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {preview.affectedOperations.map((op) => {
                      const feasibleCount = op.recoveryOptions.filter((r) => r.feasible).length;
                      return (
                        <div
                          key={op.id}
                          className="p-3 rounded-lg bg-[#081224] border border-[#182B4B] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-blue-300 font-medium">
                              {op.courseCode} · {op.day} {op.timeSlot}
                            </span>
                            <span
                              className={`font-medium ${
                                feasibleCount > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {feasibleCount} feasible plan{feasibleCount === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="text-slate-200">{op.courseName}</div>
                          <div className="text-slate-400">
                            {op.batchName} · {op.originalRoomName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-6 text-center">
              Select a valid target resource to compute impact preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
