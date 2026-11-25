import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Search } from 'lucide-react';
import { CampusState, ResourceCategory } from '../types/campus';
import { StatusLabel } from './StatusLabel';

interface DependencyMappingViewProps {
  state: CampusState;
  onSimulateResourceFailure: (category: ResourceCategory, resourceId: string) => void;
}

type FocusKind = 'room' | 'faculty' | 'course' | 'batch' | 'bus';

export function DependencyMappingView({
  state,
  onSimulateResourceFailure,
}: DependencyMappingViewProps) {
  const [viewMode, setViewMode] = useState<'explorer' | 'matrix'>('explorer');
  const [focusKind, setFocusKind] = useState<FocusKind>('room');
  const [selectedId, setSelectedId] = useState<string>(
    state.rooms.find((r) => r.id === 'LAB-B1')?.id ?? state.rooms[0]?.id ?? ''
  );
  const [matrixSearch, setMatrixSearch] = useState('');

  // Available items for the chosen category
  const itemOptions = useMemo(() => {
    if (focusKind === 'room') {
      return state.rooms.map((r) => ({
        id: r.id,
        label: `${r.code} — ${r.name}`,
        meta: `${r.blockId} · Cap ${r.capacity}`,
        status: r.status,
      }));
    }
    if (focusKind === 'faculty') {
      return state.faculty.map((f) => ({
        id: f.id,
        label: f.name,
        meta: f.department,
        status: f.status,
      }));
    }
    if (focusKind === 'course') {
      return state.courses.map((c) => ({
        id: c.id,
        label: `${c.code} — ${c.name}`,
        meta: c.department,
        status: 'Operational' as const,
      }));
    }
    if (focusKind === 'batch') {
      return state.batches.map((b) => ({
        id: b.id,
        label: `${b.code} (${b.studentCount} students)`,
        meta: b.department,
        status: 'Operational' as const,
      }));
    }
    return state.buses.map((bus) => ({
      id: bus.id,
      label: `${bus.code} — ${bus.routeName}`,
      meta: `${bus.assignedStudentsCount} commuters`,
      status: bus.status,
    }));
  }, [focusKind, state]);

  // Ensure selectedId is valid whenever focusKind changes
  const activeId = itemOptions.some((o) => o.id === selectedId)
    ? selectedId
    : itemOptions[0]?.id ?? '';

  const activeItem = itemOptions.find((o) => o.id === activeId) ?? null;

  // Resolve ONLY the timetable connections linked to activeId
  const connectedRows = useMemo(() => {
    if (!activeId) return [];

    return state.timetable
      .filter((s) => {
        if (focusKind === 'room') return s.roomId === activeId;
        if (focusKind === 'faculty') return s.facultyId === activeId;
        if (focusKind === 'course') return s.courseId === activeId;
        if (focusKind === 'batch') return s.batchId === activeId;
        if (focusKind === 'bus') {
          const bus = state.buses.find((b) => b.id === activeId);
          return bus?.servedBatchIds.includes(s.batchId) ?? false;
        }
        return false;
      })
      .map((s) => {
        const course = state.courses.find((c) => c.id === s.courseId)!;
        const faculty = state.faculty.find((f) => f.id === s.facultyId)!;
        const room = state.rooms.find((r) => r.id === s.roomId)!;
        const batch = state.batches.find((b) => b.id === s.batchId)!;
        const bus = state.buses.find((b) => b.id === batch.primaryBusId) ?? null;
        return { session: s, course, faculty, room, batch, bus };
      });
  }, [activeId, focusKind, state]);

  // Plain-language blast summary for the currently selected item
  const summaryStats = useMemo(() => {
    const uniqueBatches = new Map<string, number>();
    const uniqueFaculty = new Set<string>();
    const uniqueOps = new Set<string>();

    for (const row of connectedRows) {
      uniqueBatches.set(row.batch.id, row.batch.studentCount);
      uniqueFaculty.add(row.faculty.id);
      for (const op of row.session.connectedOperations) {
        uniqueOps.add(op);
      }
    }

    const totalStudents = Array.from(uniqueBatches.values()).reduce((sum, n) => sum + n, 0);

    return {
      sessionsCount: connectedRows.length,
      totalStudents,
      facultyCount: uniqueFaculty.size,
      opsCount: uniqueOps.size,
    };
  }, [connectedRows]);

  const handleCategorySwitch = (kind: FocusKind) => {
    setFocusKind(kind);
    if (kind === 'room') setSelectedId(state.rooms[0]?.id ?? '');
    if (kind === 'faculty') setSelectedId(state.faculty[0]?.id ?? '');
    if (kind === 'course') setSelectedId(state.courses[0]?.id ?? '');
    if (kind === 'batch') setSelectedId(state.batches[0]?.id ?? '');
    if (kind === 'bus') setSelectedId(state.buses[0]?.id ?? '');
  };

  const jumpToNode = (kind: FocusKind, id: string) => {
    setFocusKind(kind);
    setSelectedId(id);
  };

  const triggerFailure = () => {
    if (!activeId) return;
    if (focusKind === 'room') {
      const room = state.rooms.find((r) => r.id === activeId);
      onSimulateResourceFailure(room?.category ?? 'classroom', activeId);
    } else if (focusKind === 'faculty') {
      onSimulateResourceFailure('faculty', activeId);
    } else if (focusKind === 'bus') {
      onSimulateResourceFailure('bus', activeId);
    }
  };

  const matrixSessions = useMemo(() => {
    return state.timetable.filter((s) => {
      const course = state.courses.find((c) => c.id === s.courseId);
      const fac = state.faculty.find((f) => f.id === s.facultyId);
      const room = state.rooms.find((r) => r.id === s.roomId);
      const batch = state.batches.find((b) => b.id === s.batchId);

      if (!matrixSearch.trim()) return true;
      const q = matrixSearch.toLowerCase();
      return (
        course?.code.toLowerCase().includes(q) ||
        course?.name.toLowerCase().includes(q) ||
        fac?.name.toLowerCase().includes(q) ||
        room?.code.toLowerCase().includes(q) ||
        batch?.code.toLowerCase().includes(q) ||
        s.day.toLowerCase().includes(q)
      );
    });
  }, [state, matrixSearch]);

  const kindTabs: { id: FocusKind; label: string }[] = [
    { id: 'room', label: 'Classrooms & Labs' },
    { id: 'faculty', label: 'Faculty' },
    { id: 'course', label: 'Courses' },
    { id: 'batch', label: 'Student Cohorts' },
    { id: 'bus', label: 'Transit Buses' },
  ];

  return (
    <div className="space-y-5">
      {/* Top Bar: View Toggle + Plain Instructions */}
      <div className="bg-white border border-sky-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-1 p-1 bg-sky-50 rounded-lg border border-sky-200/80">
          <button
            type="button"
            onClick={() => setViewMode('explorer')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'explorer'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Simple Dependency Explorer
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'matrix'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Full Timetable Matrix
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Pick any campus resource below to see only its direct connections without visual clutter
        </div>
      </div>

      {viewMode === 'explorer' ? (
        <div className="space-y-5">
          {/* Step 1: Category & Resource Picker */}
          <div className="bg-white border border-sky-200/80 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {kindTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleCategorySwitch(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      focusKind === tab.id
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-sky-50/60 text-slate-700 border-sky-200 hover:bg-sky-100/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {(focusKind === 'room' || focusKind === 'faculty' || focusKind === 'bus') && activeItem && (
                <button
                  type="button"
                  onClick={triggerFailure}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Simulate Failure on Selected</span>
                </button>
              )}
            </div>

            {/* Selectable Item Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {itemOptions.map((item) => {
                const isSelected = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-500/30'
                        : 'bg-white border-sky-200/70 hover:bg-sky-50/40 hover:border-sky-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 leading-snug">
                        {item.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">{item.meta}</span>
                      <StatusLabel status={item.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Plain-Language Impact Summary */}
          {activeItem && (
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-sky-950">
                  Direct Connections for {activeItem.label}
                </div>
                <p className="text-xs text-slate-600">
                  {summaryStats.sessionsCount === 0
                    ? 'No scheduled timetable classes currently depend on this item.'
                    : `Connected to ${summaryStats.sessionsCount} weekly class${
                        summaryStats.sessionsCount === 1 ? '' : 'es'
                      }, ${summaryStats.facultyCount} faculty member${
                        summaryStats.facultyCount === 1 ? '' : 's'
                      }, ${summaryStats.totalStudents} students, and ${summaryStats.opsCount} downstream campus operations.`}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-sky-900 font-semibold">
                <span>{summaryStats.sessionsCount} classes</span>
                <span aria-hidden="true" className="text-sky-300">·</span>
                <span>{summaryStats.totalStudents} students</span>
              </div>
            </div>
          )}

          {/* Step 3: Clean Row-by-Row Connected Chains (Zero Crossing Lines) */}
          <div className="bg-white border border-sky-200/80 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Connected Dependency Chains
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each row shows one complete operational chain. Click any card to inspect that item.
                </p>
              </div>
            </div>

            {connectedRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 bg-sky-50/40 rounded-lg border border-sky-100">
                No timetable dependencies found for this selection.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Column Guide */}
                <div className="hidden lg:grid lg:grid-cols-11 gap-2 px-2 text-[11px] font-semibold text-slate-500">
                  <div className="col-span-2">1. Faculty</div>
                  <div className="col-span-1" />
                  <div className="col-span-2">2. Course & Slot</div>
                  <div className="col-span-1" />
                  <div className="col-span-2">3. Room & Equipment</div>
                  <div className="col-span-1" />
                  <div className="col-span-2">4. Students & Bus</div>
                </div>

                {connectedRows.map(({ session, course, faculty, room, batch, bus }) => (
                  <div
                    key={session.id}
                    className="p-3.5 rounded-xl bg-sky-50/40 border border-sky-200/80 space-y-3"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-11 gap-2 items-center">
                      {/* 1. Faculty */}
                      <button
                        type="button"
                        onClick={() => jumpToNode('faculty', faculty.id)}
                        className={`lg:col-span-2 text-left p-2.5 rounded-lg border transition-colors ${
                          focusKind === 'faculty' && activeId === faculty.id
                            ? 'bg-sky-100 border-sky-500'
                            : 'bg-white border-sky-200 hover:border-sky-400'
                        }`}
                      >
                        <div className="text-[10px] font-medium text-slate-400 lg:hidden">Faculty</div>
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {faculty.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {faculty.department}
                        </div>
                        <div className="mt-1">
                          <StatusLabel status={faculty.status} />
                        </div>
                      </button>

                      <div className="hidden lg:flex justify-center text-sky-500">
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </div>

                      {/* 2. Course & Timetable Slot */}
                      <button
                        type="button"
                        onClick={() => jumpToNode('course', course.id)}
                        className={`lg:col-span-2 text-left p-2.5 rounded-lg border transition-colors ${
                          focusKind === 'course' && activeId === course.id
                            ? 'bg-sky-100 border-sky-500'
                            : 'bg-white border-sky-200 hover:border-sky-400'
                        }`}
                      >
                        <div className="text-[10px] font-medium text-slate-400 lg:hidden">Course</div>
                        <div className="font-mono text-xs font-semibold text-sky-700">
                          {course.code} · {session.day} {session.timeSlot}
                        </div>
                        <div className="text-xs font-medium text-slate-900 truncate mt-0.5">
                          {course.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {session.sessionType}
                        </div>
                      </button>

                      <div className="hidden lg:flex justify-center text-sky-500">
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </div>

                      {/* 3. Room / Lab & Required Equipment */}
                      <button
                        type="button"
                        onClick={() => jumpToNode('room', room.id)}
                        className={`lg:col-span-2 text-left p-2.5 rounded-lg border transition-colors ${
                          focusKind === 'room' && activeId === room.id
                            ? 'bg-sky-100 border-sky-500'
                            : 'bg-white border-sky-200 hover:border-sky-400'
                        }`}
                      >
                        <div className="text-[10px] font-medium text-slate-400 lg:hidden">Room / Lab</div>
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {room.code} ({room.blockId})
                        </div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">
                          {course.requiredEquipmentTypes.join(', ') || 'Standard Projector'}
                        </div>
                        <div className="mt-1">
                          <StatusLabel status={room.status} />
                        </div>
                      </button>

                      <div className="hidden lg:flex justify-center text-sky-500">
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </div>

                      {/* 4. Student Cohort & Transit Bus */}
                      <div className="lg:col-span-2 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => jumpToNode('batch', batch.id)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                            focusKind === 'batch' && activeId === batch.id
                              ? 'bg-sky-100 border-sky-500'
                              : 'bg-white border-sky-200 hover:border-sky-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                            <span>{batch.code}</span>
                            <span className="font-mono text-sky-700 tabular-nums">
                              {batch.studentCount} students
                            </span>
                          </div>
                          {bus && (
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                              Bus {bus.code} · {batch.commuterCount} commuters
                            </div>
                          )}
                        </button>
                      </div>
                    </div>

                    {session.connectedOperations.length > 0 && (
                      <div className="pt-2 border-t border-sky-200/60 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-semibold text-sky-900">Connected Operations:</span>
                        <span>{session.connectedOperations.join(' · ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Full Timetable Cross-Matrix View */
        <div className="bg-white border border-sky-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-sky-100 bg-sky-50/40 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search timetable by course, room, faculty, day, or cohort..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-sky-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              {matrixSessions.length} scheduled sessions
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-200/80 bg-sky-50/70 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Slot</th>
                  <th className="py-3 px-4 whitespace-nowrap">Course</th>
                  <th className="py-3 px-4 whitespace-nowrap">Faculty</th>
                  <th className="py-3 px-4 whitespace-nowrap">Room / Lab</th>
                  <th className="py-3 px-4 whitespace-nowrap">Required Equipment</th>
                  <th className="py-3 px-4 whitespace-nowrap">Student Cohort & Bus</th>
                  <th className="py-3 px-4 whitespace-nowrap">Connected Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 text-xs">
                {matrixSessions.map((s) => {
                  const course = state.courses.find((c) => c.id === s.courseId)!;
                  const fac = state.faculty.find((f) => f.id === s.facultyId)!;
                  const room = state.rooms.find((r) => r.id === s.roomId)!;
                  const batch = state.batches.find((b) => b.id === s.batchId)!;
                  const bus = state.buses.find((b) => b.id === batch.primaryBusId);

                  return (
                    <tr key={s.id} className="hover:bg-sky-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-sky-700 font-semibold whitespace-nowrap">
                        {s.day} {s.timeSlot}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {course.code} — {course.name}
                        </div>
                        <div className="text-slate-500">{s.sessionType}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-800">
                        <div>{fac.name}</div>
                        <StatusLabel status={fac.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-800">
                          {room.code} ({room.blockId})
                        </div>
                        <StatusLabel status={room.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">
                        {course.requiredEquipmentTypes.join(', ') || 'Standard Classroom'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 tabular-nums">
                        <div>
                          {batch.code} ({batch.studentCount} students)
                        </div>
                        <div className="text-slate-500">
                          {bus ? `${bus.code} (${batch.commuterCount} commuters)` : 'Campus Hostel'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs">
                        {s.connectedOperations.join(' · ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
