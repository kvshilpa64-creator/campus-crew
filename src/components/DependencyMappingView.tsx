import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Search } from 'lucide-react';
import { CampusState, ResourceCategory } from '../types/campus';
import { StatusLabel } from './StatusLabel';

interface DependencyMappingViewProps {
  state: CampusState;
  onSimulateResourceFailure: (category: ResourceCategory, resourceId: string) => void;
}

interface GraphNode {
  id: string;
  label: string;
  sublabel: string;
  column: 0 | 1 | 2 | 3 | 4;
  kind: 'faculty' | 'course' | 'room' | 'batch' | 'bus';
  status: 'Operational' | 'Maintenance' | 'Unavailable';
  department?: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

export function DependencyMappingView({
  state,
  onSimulateResourceFailure,
}: DependencyMappingViewProps) {
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    state.rooms.find((r) => r.id === 'LAB-B1')?.id ?? state.rooms[0]?.id ?? null
  );
  const [viewMode, setViewMode] = useState<'graph' | 'matrix'>('graph');
  const [matrixSearch, setMatrixSearch] = useState('');

  const departments = useMemo(() => {
    const depts = new Set(state.courses.map((c) => c.department));
    return ['ALL', ...Array.from(depts)];
  }, [state.courses]);

  // Build filtered graph nodes & edges from live state
  const { nodes, edges } = useMemo(() => {
    const filteredSessions = state.timetable.filter((s) => {
      if (departmentFilter === 'ALL') return true;
      const course = state.courses.find((c) => c.id === s.courseId);
      return course?.department === departmentFilter;
    });

    const usedFaculty = new Set(filteredSessions.map((s) => s.facultyId));
    const usedCourses = new Set(filteredSessions.map((s) => s.courseId));
    const usedRooms = new Set(filteredSessions.map((s) => s.roomId));
    const usedBatches = new Set(filteredSessions.map((s) => s.batchId));
    const usedBuses = new Set(
      state.batches
        .filter((b) => usedBatches.has(b.id) && b.primaryBusId)
        .map((b) => b.primaryBusId!)
    );

    const gNodes: GraphNode[] = [
      ...state.faculty
        .filter((f) => departmentFilter === 'ALL' || usedFaculty.has(f.id))
        .map((f) => ({
          id: f.id,
          label: f.name,
          sublabel: f.department,
          column: 0 as const,
          kind: 'faculty' as const,
          status: f.status,
          department: f.department,
        })),
      ...state.courses
        .filter((c) => departmentFilter === 'ALL' || usedCourses.has(c.id))
        .map((c) => ({
          id: c.id,
          label: `${c.code}`,
          sublabel: c.name,
          column: 1 as const,
          kind: 'course' as const,
          status: 'Operational' as const,
          department: c.department,
        })),
      ...state.rooms
        .filter((r) => departmentFilter === 'ALL' || usedRooms.has(r.id))
        .map((r) => ({
          id: r.id,
          label: r.code,
          sublabel: `${r.name} · ${r.blockId}`,
          column: 2 as const,
          kind: 'room' as const,
          status: r.status,
        })),
      ...state.batches
        .filter((b) => departmentFilter === 'ALL' || usedBatches.has(b.id))
        .map((b) => ({
          id: b.id,
          label: b.code,
          sublabel: `${b.studentCount} students`,
          column: 3 as const,
          kind: 'batch' as const,
          status: 'Operational' as const,
        })),
      ...state.buses
        .filter((bus) => departmentFilter === 'ALL' || usedBuses.has(bus.id))
        .map((bus) => ({
          id: bus.id,
          label: bus.code,
          sublabel: bus.routeName,
          column: 4 as const,
          kind: 'bus' as const,
          status: bus.status,
        })),
    ];

    const edgeSet = new Set<string>();
    const gEdges: GraphEdge[] = [];

    const addEdge = (from: string, to: string) => {
      const key = `${from}->${to}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        gEdges.push({ from, to });
      }
    };

    for (const s of filteredSessions) {
      addEdge(s.facultyId, s.courseId);
      addEdge(s.courseId, s.roomId);
      addEdge(s.roomId, s.batchId);
    }

    for (const b of state.batches) {
      if (b.primaryBusId && (departmentFilter === 'ALL' || usedBatches.has(b.id))) {
        addEdge(b.id, b.primaryBusId);
      }
    }

    return { nodes: gNodes, edges: gEdges };
  }, [state, departmentFilter]);

  // Compute SVG coordinates for each column
  const svgWidth = 1040;
  const colX = [100, 310, 520, 730, 940];
  const nodeW = 168;
  const nodeH = 48;
  const rowGap = 14;

  const positionedNodes = useMemo(() => {
    const columns: GraphNode[][] = [[], [], [], [], []];
    for (const n of nodes) {
      columns[n.column].push(n);
    }
    const maxRows = Math.max(1, ...columns.map((c) => c.length));
    const totalHeight = Math.max(460, maxRows * (nodeH + rowGap) + 60);

    const posMap = new Map<string, { x: number; y: number; node: GraphNode }>();
    columns.forEach((colNodes, cIdx) => {
      const colHeight = colNodes.length * nodeH + Math.max(0, colNodes.length - 1) * rowGap;
      const startY = (totalHeight - colHeight) / 2 + 12;
      colNodes.forEach((n, rIdx) => {
        posMap.set(n.id, {
          x: colX[cIdx] - nodeW / 2,
          y: startY + rIdx * (nodeH + rowGap),
          node: n,
        });
      });
    });

    return { posMap, totalHeight };
  }, [nodes]);

  // Connected nodes BFS from selectedNodeId so selecting any node highlights the entire dependency chain
  const connectedIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNodeId) return set;
    set.add(selectedNodeId);

    // Traverse both upstream & downstream via edges
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        if (set.has(e.from) && !set.has(e.to)) {
          set.add(e.to);
          changed = true;
        }
        if (set.has(e.to) && !set.has(e.from)) {
          set.add(e.from);
          changed = true;
        }
      }
    }
    return set;
  }, [selectedNodeId, edges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Sessions linked to selected node
  const selectedSessions = useMemo(() => {
    if (!selectedNode) return [];
    return state.timetable.filter((s) => {
      if (selectedNode.kind === 'faculty') return s.facultyId === selectedNode.id;
      if (selectedNode.kind === 'course') return s.courseId === selectedNode.id;
      if (selectedNode.kind === 'room') return s.roomId === selectedNode.id;
      if (selectedNode.kind === 'batch') return s.batchId === selectedNode.id;
      if (selectedNode.kind === 'bus') {
        const bus = state.buses.find((b) => b.id === selectedNode.id);
        return bus?.servedBatchIds.includes(s.batchId) ?? false;
      }
      return false;
    });
  }, [selectedNode, state]);

  const matrixSessions = useMemo(() => {
    return state.timetable.filter((s) => {
      const course = state.courses.find((c) => c.id === s.courseId);
      const fac = state.faculty.find((f) => f.id === s.facultyId);
      const room = state.rooms.find((r) => r.id === s.roomId);
      const batch = state.batches.find((b) => b.id === s.batchId);

      if (departmentFilter !== 'ALL' && course?.department !== departmentFilter) return false;
      if (matrixSearch.trim()) {
        const q = matrixSearch.toLowerCase();
        return (
          course?.code.toLowerCase().includes(q) ||
          course?.name.toLowerCase().includes(q) ||
          fac?.name.toLowerCase().includes(q) ||
          room?.code.toLowerCase().includes(q) ||
          batch?.code.toLowerCase().includes(q) ||
          s.day.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state, departmentFilter, matrixSearch]);

  const triggerFailureFromNode = () => {
    if (!selectedNode) return;
    if (selectedNode.kind === 'room') {
      const room = state.rooms.find((r) => r.id === selectedNode.id);
      onSimulateResourceFailure(room?.category ?? 'classroom', selectedNode.id);
    } else if (selectedNode.kind === 'faculty') {
      onSimulateResourceFailure('faculty', selectedNode.id);
    } else if (selectedNode.kind === 'bus') {
      onSimulateResourceFailure('bus', selectedNode.id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#071020] rounded-lg border border-[#162745]">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'graph' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Interactive Dependency Graph
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'matrix' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Timetable Cross-Matrix
            </button>
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter by department"
            className="px-3 py-2 text-xs bg-[#071020] border border-[#1A2D4F] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All Campus Departments' : d}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Click any node to trace upstream & downstream operational links
        </div>
      </div>

      {viewMode === 'graph' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          {/* Interactive SVG Graph Canvas */}
          <div className="xl:col-span-8 bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-4 overflow-x-auto">
            <div className="min-w-[820px]">
              {/* Column Headers */}
              <div className="grid grid-cols-5 text-center text-xs font-medium text-slate-400 pb-2 border-b border-[#152542]">
                <span>Faculty</span>
                <span>Courses</span>
                <span>Classrooms & Labs</span>
                <span>Student Cohorts</span>
                <span>Transit Buses</span>
              </div>

              <svg
                viewBox={`0 0 ${svgWidth} ${positionedNodes.totalHeight}`}
                className="w-full h-auto block"
              >
                {/* Edges */}
                {edges.map((edge) => {
                  const fromPos = positionedNodes.posMap.get(edge.from);
                  const toPos = positionedNodes.posMap.get(edge.to);
                  if (!fromPos || !toPos) return null;

                  const x1 = fromPos.x + nodeW;
                  const y1 = fromPos.y + nodeH / 2;
                  const x2 = toPos.x;
                  const y2 = toPos.y + nodeH / 2;
                  const cx1 = x1 + (x2 - x1) * 0.45;
                  const cx2 = x2 - (x2 - x1) * 0.45;

                  const isHighlighted =
                    !selectedNodeId ||
                    (connectedIds.has(edge.from) && connectedIds.has(edge.to));

                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={isHighlighted && selectedNodeId ? '#3B82F6' : '#263F6B'}
                      strokeWidth={isHighlighted && selectedNodeId ? 2.2 : 1.2}
                      strokeOpacity={isHighlighted ? 0.9 : 0.16}
                    />
                  );
                })}

                {/* Nodes */}
                {Array.from(positionedNodes.posMap.values()).map(({ x, y, node }) => {
                  const isSelected = selectedNodeId === node.id;
                  const isConnected = !selectedNodeId || connectedIds.has(node.id);
                  const isDown = node.status === 'Unavailable';
                  const isMaint = node.status === 'Maintenance';

                  const strokeColor = isSelected
                    ? '#60A5FA'
                    : isDown
                    ? '#EF4444'
                    : isMaint
                    ? '#F59E0B'
                    : isConnected && selectedNodeId
                    ? '#3B82F6'
                    : '#1E3358';

                  const fillColor = isSelected
                    ? '#132B54'
                    : isDown
                    ? '#23101B'
                    : '#091529';

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x}, ${y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                      style={{ opacity: isConnected ? 1 : 0.25 }}
                    >
                      <rect
                        width={nodeW}
                        height={nodeH}
                        rx={8}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2 : 1.2}
                      />
                      <text
                        x={12}
                        y={20}
                        fill={isDown ? '#FCA5A5' : '#F8FAFC'}
                        fontSize="12"
                        fontWeight="600"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {node.label.length > 21 ? `${node.label.slice(0, 20)}…` : node.label}
                      </text>
                      <text
                        x={12}
                        y={36}
                        fill="#94A3B8"
                        fontSize="10"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {node.sublabel.length > 26
                          ? `${node.sublabel.slice(0, 25)}…`
                          : node.sublabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Right Dependency Inspector Panel */}
          <div className="xl:col-span-4 bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-5 flex flex-col justify-between">
            {selectedNode ? (
              <div className="space-y-5">
                <div className="border-b border-[#1A2D4F] pb-4">
                  <div className="text-xs text-slate-400 capitalize">
                    {selectedNode.kind} Node · <span className="font-mono">{selectedNode.id}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mt-1">
                    {selectedNode.label}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedNode.sublabel}</p>
                  <div className="mt-2.5">
                    <StatusLabel status={selectedNode.status} />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2.5">
                    Linked Timetable Operations ({selectedSessions.length})
                  </div>
                  {selectedSessions.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No active timetable sessions currently bound to this node.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {selectedSessions.map((s) => {
                        const course = state.courses.find((c) => c.id === s.courseId);
                        const room = state.rooms.find((r) => r.id === s.roomId);
                        const fac = state.faculty.find((f) => f.id === s.facultyId);
                        const batch = state.batches.find((b) => b.id === s.batchId);

                        return (
                          <div
                            key={s.id}
                            className="p-3 rounded-lg bg-[#081224] border border-[#182B4B] space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-blue-300 font-medium">
                                {course?.code} · {s.day} {s.timeSlot}
                              </span>
                              <span className="text-slate-400">{batch?.code}</span>
                            </div>
                            <div className="text-slate-200 font-medium">{course?.name}</div>
                            <div className="text-slate-400">
                              {room?.code} · {fac?.name}
                            </div>
                            {s.connectedOperations.length > 0 && (
                              <div className="pt-1 text-[11px] text-slate-400">
                                Connected: {s.connectedOperations.join(' · ')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {(selectedNode.kind === 'room' ||
                  selectedNode.kind === 'faculty' ||
                  selectedNode.kind === 'bus') && (
                  <button
                    type="button"
                    onClick={triggerFailureFromNode}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Simulate Failure on This Resource</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-8 text-center">
                Select any node in the campus dependency graph to inspect linked courses, cohorts, equipment, and timetable operations.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Timetable Cross-Matrix View */
        <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#1A2D4F] flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search timetable by course, room, faculty, day, or cohort..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#071020] border border-[#1A2D4F] rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {matrixSessions.length} scheduled sessions
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A2D4F] bg-[#081224] text-xs font-medium text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">Slot</th>
                  <th className="py-3 px-4 whitespace-nowrap">Course</th>
                  <th className="py-3 px-4 whitespace-nowrap">Faculty</th>
                  <th className="py-3 px-4 whitespace-nowrap">Room / Lab</th>
                  <th className="py-3 px-4 whitespace-nowrap">Required Equipment</th>
                  <th className="py-3 px-4 whitespace-nowrap">Student Cohort & Bus</th>
                  <th className="py-3 px-4 whitespace-nowrap">Connected Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152542] text-xs">
                {matrixSessions.map((s) => {
                  const course = state.courses.find((c) => c.id === s.courseId)!;
                  const fac = state.faculty.find((f) => f.id === s.facultyId)!;
                  const room = state.rooms.find((r) => r.id === s.roomId)!;
                  const batch = state.batches.find((b) => b.id === s.batchId)!;
                  const bus = state.buses.find((b) => b.id === batch.primaryBusId);

                  return (
                    <tr key={s.id} className="hover:bg-[#0E1D38] transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-blue-300 whitespace-nowrap">
                        {s.day} {s.timeSlot}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">
                          {course.code} — {course.name}
                        </div>
                        <div className="text-slate-400">{s.sessionType}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-200">
                        <div>{fac.name}</div>
                        <StatusLabel status={fac.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-200">
                          {room.code} ({room.blockId})
                        </div>
                        <StatusLabel status={room.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs">
                        {course.requiredEquipmentTypes.join(', ') || 'Standard Classroom'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300 tabular-nums">
                        <div>
                          {batch.code} ({batch.studentCount} students)
                        </div>
                        <div className="text-slate-400">
                          {bus ? `${bus.code} (${batch.commuterCount} commuters)` : 'Campus Hostel'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs">
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
