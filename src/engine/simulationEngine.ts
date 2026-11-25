import { DAYS_OF_WEEK, TIME_SLOTS } from '../data/sampleCampusData';
import {
  AffectedOperation,
  CampusBlockId,
  CampusState,
  CascadingTier,
  ConstraintCheckResult,
  DayOfWeek,
  FailureScenarioType,
  IncidentRecord,
  PowerInternetSubtype,
  RecoveryOption,
  RoomResource,
  TimeSlotCode,
  TimetableSession,
} from '../types/campus';

export interface SimulationRequest {
  scenarioType: FailureScenarioType;
  targetId: string;
  subType?: PowerInternetSubtype;
  dayFilter: DayOfWeek | 'ALL';
  timeSlotFilter: TimeSlotCode | 'ALL';
  notes: string;
}

export interface SystemHealthMetrics {
  healthScore: number;
  statusLabel: 'Nominal' | 'Degraded' | 'Critical';
  totalResources: number;
  operationalResources: number;
  unavailableResources: number;
  maintenanceResources: number;
  totalStudents: number;
  activeIncidentsCount: number;
  affectedClassesCount: number;
  affectedStudentsCount: number;
}

export function computeSystemHealth(state: CampusState): SystemHealthMetrics {
  const allResources = [
    ...state.rooms,
    ...state.faculty,
    ...state.buses,
    ...state.equipment,
  ];
  const totalResources = allResources.length;
  const operationalResources = allResources.filter((r) => r.status === 'Operational').length;
  const maintenanceResources = allResources.filter((r) => r.status === 'Maintenance').length;
  const unavailableResources = allResources.filter((r) => r.status === 'Unavailable').length;

  const activeIncidents = state.incidents.filter((inc) => inc.status !== 'Resolved');

  const unmitigatedSessionIds = new Set<string>();
  let affectedStudentsCount = 0;
  const impactedBatches = new Set<string>();

  for (const inc of activeIncidents) {
    for (const op of inc.affectedOperations) {
      if (!op.appliedRecovery) {
        unmitigatedSessionIds.add(op.sessionId);
        if (!impactedBatches.has(op.batchId)) {
          impactedBatches.add(op.batchId);
          affectedStudentsCount += op.studentCount;
        }
      }
    }
  }

  const totalStudents = state.batches.reduce((sum, b) => sum + b.studentCount, 0);
  const resourceRatio = totalResources > 0 ? operationalResources / totalResources : 1;
  const sessionRatio =
    state.timetable.length > 0
      ? Math.max(0, state.timetable.length - unmitigatedSessionIds.size) / state.timetable.length
      : 1;

  // Weighted health score: 55% resource readiness + 45% unaffected timetable integrity
  const rawScore = Math.round((resourceRatio * 0.55 + sessionRatio * 0.45) * 100);
  const healthScore = Math.max(0, Math.min(100, rawScore));

  let statusLabel: 'Nominal' | 'Degraded' | 'Critical' = 'Nominal';
  if (healthScore < 72 || activeIncidents.some((i) => i.severity === 'Critical' && i.status === 'Active')) {
    statusLabel = 'Critical';
  } else if (healthScore < 94 || activeIncidents.length > 0) {
    statusLabel = 'Degraded';
  }

  return {
    healthScore,
    statusLabel,
    totalResources,
    operationalResources,
    unavailableResources,
    maintenanceResources,
    totalStudents,
    activeIncidentsCount: activeIncidents.length,
    affectedClassesCount: unmitigatedSessionIds.size,
    affectedStudentsCount,
  };
}

function getRoomEquipmentTags(room: RoomResource, state: CampusState): string[] {
  const linkedEquip = state.equipment
    .filter((eq) => eq.locationId === room.id && eq.status === 'Operational')
    .map((eq) => eq.equipmentType);
  return Array.from(new Set([...room.equipmentTags, ...linkedEquip]));
}

function isRoomBusyAt(
  roomId: string,
  day: DayOfWeek,
  timeSlot: TimeSlotCode,
  state: CampusState,
  ignoreSessionId?: string
): TimetableSession | undefined {
  return state.timetable.find(
    (s) => s.roomId === roomId && s.day === day && s.timeSlot === timeSlot && s.id !== ignoreSessionId
  );
}

function isFacultyBusyAt(
  facultyId: string,
  day: DayOfWeek,
  timeSlot: TimeSlotCode,
  state: CampusState,
  ignoreSessionId?: string
): TimetableSession | undefined {
  return state.timetable.find(
    (s) => s.facultyId === facultyId && s.day === day && s.timeSlot === timeSlot && s.id !== ignoreSessionId
  );
}

function isBatchBusyAt(
  batchId: string,
  day: DayOfWeek,
  timeSlot: TimeSlotCode,
  state: CampusState,
  ignoreSessionId?: string
): TimetableSession | undefined {
  return state.timetable.find(
    (s) => s.batchId === batchId && s.day === day && s.timeSlot === timeSlot && s.id !== ignoreSessionId
  );
}

function facultyMatchesCourse(qualifications: string[], courseName: string, courseDept: string, facDept: string): boolean {
  const lowerCourse = courseName.toLowerCase();
  const directMatch = qualifications.some((q) => {
    const tokens = q.toLowerCase().split(/[\s&,/]+/).filter((t) => t.length > 3);
    return tokens.some((t) => lowerCourse.includes(t));
  });
  if (directMatch) return true;
  return facDept === courseDept;
}

export function evaluateRecoveryOptions(
  session: TimetableSession,
  scenarioType: FailureScenarioType,
  disabledResourceIds: Set<string>,
  state: CampusState,
  busId?: string
): RecoveryOption[] {
  const course = state.courses.find((c) => c.id === session.courseId)!;
  const batch = state.batches.find((b) => b.id === session.batchId)!;
  const originalRoom = state.rooms.find((r) => r.id === session.roomId)!;
  const originalFaculty = state.faculty.find((f) => f.id === session.facultyId)!;

  const options: RecoveryOption[] = [];

  // 1. BUS BREAKDOWN RECOVERY OPTIONS
  if (scenarioType === 'bus_breakdown' && busId) {
    const failedBus = state.buses.find((b) => b.id === busId);
    const affectedBatchCommuters = batch.commuterCount;

    for (const candidateBus of state.buses) {
      if (candidateBus.id === busId) continue;

      const isOperational =
        candidateBus.status === 'Operational' && !disabledResourceIds.has(candidateBus.id);
      const spareSeats = candidateBus.capacity - candidateBus.assignedStudentsCount;
      const hasCapacity = spareSeats >= affectedBatchCommuters;
      const windowCompatible = true;

      const checks: ConstraintCheckResult[] = [
        {
          label: 'Fleet Status',
          passed: isOperational,
          detail: isOperational
            ? `${candidateBus.code} is Operational`
            : `${candidateBus.code} is ${candidateBus.status}`,
        },
        {
          label: 'Seat Capacity',
          passed: hasCapacity,
          detail: hasCapacity
            ? `${spareSeats} spare seats >= ${affectedBatchCommuters} stranded commuters`
            : `Only ${spareSeats} spare seats available (${affectedBatchCommuters} required)`,
        },
        {
          label: 'Arrival Window',
          passed: windowCompatible,
          detail: `Reaches campus before ${session.timeSlot} (${candidateBus.arrivalWindow})`,
        },
      ];

      const feasible = isOperational && hasCapacity && windowCompatible;
      options.push({
        id: `REC-BUS-${session.id}-${candidateBus.id}`,
        type: 'bus_reroute',
        title: `Dispatch ${candidateBus.routeName}`,
        subtitle: `Driver ${candidateBus.driverName} · Cap ${candidateBus.capacity} (${spareSeats} free)`,
        targetResourceId: candidateBus.id,
        feasible,
        score: feasible ? 95 - (candidateBus.assignedStudentsCount > 0 ? 10 : 0) : 20,
        checks,
        summary: feasible
          ? `Feasible: ${candidateBus.code} absorbs ${affectedBatchCommuters} commuters from ${failedBus?.code ?? busId} with ${spareSeats - affectedBatchCommuters} seats margin.`
          : `Not Feasible: ${!isOperational ? `${candidateBus.code} is ${candidateBus.status}.` : `Insufficient spare capacity (${spareSeats} < ${affectedBatchCommuters} commuters).`}`,
      });
    }

    // Also allow rescheduling morning session to afternoon when commuters arrive via metro/alternate transit
    const afternoonSlots: TimeSlotCode[] = ['13:00–14:30', '14:45–16:15'];
    for (const altSlot of afternoonSlots) {
      const roomConflict = isRoomBusyAt(originalRoom.id, session.day, altSlot, state, session.id);
      const facConflict = isFacultyBusyAt(originalFaculty.id, session.day, altSlot, state, session.id);
      const batchConflict = isBatchBusyAt(batch.id, session.day, altSlot, state, session.id);
      const roomOk = originalRoom.status === 'Operational' && !disabledResourceIds.has(originalRoom.id);

      const feasible = !roomConflict && !facConflict && !batchConflict && roomOk;
      options.push({
        id: `REC-SLOT-BUS-${session.id}-${altSlot}`,
        type: 'reschedule_slot',
        title: `Shift Session to ${session.day} ${altSlot}`,
        subtitle: `Retains ${originalRoom.code} & ${originalFaculty.name}`,
        targetResourceId: originalRoom.id,
        targetDay: session.day,
        targetTimeSlot: altSlot,
        feasible,
        score: feasible ? 78 : 15,
        checks: [
          {
            label: 'Room Free',
            passed: !roomConflict && roomOk,
            detail: !roomConflict ? `${originalRoom.code} free at ${altSlot}` : `Occupied by ${roomConflict?.courseId}`,
          },
          {
            label: 'Faculty Free',
            passed: !facConflict,
            detail: !facConflict ? `${originalFaculty.name} available` : `Teaching ${facConflict?.courseId}`,
          },
          {
            label: 'Batch Free',
            passed: !batchConflict,
            detail: !batchConflict ? `${batch.code} has no conflict` : `Attending ${batchConflict?.courseId}`,
          },
        ],
        summary: feasible
          ? `Feasible: Moves ${course.code} to ${session.day} ${altSlot}, giving stranded commuters time to reach campus.`
          : `Not Feasible: Schedule conflict detected at ${session.day} ${altSlot}.`,
      });
    }

    // Hybrid fallback for commuters
    options.push({
      id: `REC-HYB-${session.id}`,
      type: 'hybrid_fallback',
      title: `Enable Hybrid Live-Stream for ${batch.code} Commuters`,
      subtitle: `${batch.studentCount - batch.commuterCount} on-campus + ${batch.commuterCount} remote`,
      feasible: !course.requiresLab,
      score: !course.requiresLab ? 70 : 10,
      checks: [
        {
          label: 'Format Compatibility',
          passed: !course.requiresLab,
          detail: !course.requiresLab
            ? 'Theory lecture can stream synchronously'
            : 'Requires hands-on physical laboratory hardware',
        },
        {
          label: 'Room AV Readiness',
          passed: originalRoom.equipmentTags.some((t) => t.includes('Projector') || t.includes('Smart Board') || t.includes('Capture')),
          detail: `${originalRoom.code} equipped for live capture`,
        },
      ],
      summary: !course.requiresLab
        ? `Feasible: Run ${course.code} on schedule in ${originalRoom.code} with synchronous stream for ${batch.commuterCount} commuters.`
        : `Not Feasible: ${course.code} requires in-person lab hardware (${course.requiredEquipmentTypes.join(', ')}).`,
    });

    return options.sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.score - a.score);
  }

  // 2. FACULTY ABSENT RECOVERY OPTIONS
  if (scenarioType === 'faculty_absent') {
    for (const candidateFac of state.faculty) {
      if (candidateFac.id === session.facultyId) continue;

      const isAvailable =
        candidateFac.status === 'Operational' && !disabledResourceIds.has(candidateFac.id);
      const isQualified = facultyMatchesCourse(
        candidateFac.qualifications,
        course.name,
        course.department,
        candidateFac.department
      );
      const conflict = isFacultyBusyAt(candidateFac.id, session.day, session.timeSlot, state, session.id);
      const noConflict = !conflict;

      const checks: ConstraintCheckResult[] = [
        {
          label: 'Availability',
          passed: isAvailable,
          detail: isAvailable
            ? `${candidateFac.name} is Operational`
            : `${candidateFac.name} is ${candidateFac.status}`,
        },
        {
          label: 'Subject Qualification',
          passed: isQualified,
          detail: isQualified
            ? `Qualified (${candidateFac.qualifications.slice(0, 2).join(', ')})`
            : `Department mismatch (${candidateFac.department} vs ${course.department})`,
        },
        {
          label: 'Timetable Conflict',
          passed: noConflict,
          detail: noConflict
            ? `Free on ${session.day} ${session.timeSlot}`
            : `Conflict: Assigned to ${conflict?.courseId} in ${conflict?.roomId}`,
        },
      ];

      const feasible = isAvailable && isQualified && noConflict;
      options.push({
        id: `REC-FAC-${session.id}-${candidateFac.id}`,
        type: 'faculty_swap',
        title: `Assign Substitute: ${candidateFac.name}`,
        subtitle: `${candidateFac.department} · ${candidateFac.designation}`,
        targetResourceId: candidateFac.id,
        feasible,
        score: feasible ? 94 : 25,
        checks,
        summary: feasible
          ? `Feasible: ${candidateFac.name} is qualified and free at ${session.day} ${session.timeSlot} to cover ${course.code}.`
          : `Not Feasible: ${!isAvailable ? 'Faculty unavailable.' : !isQualified ? 'Lacks course qualification.' : `Busy with ${conflict?.courseId} at ${session.timeSlot}.`}`,
      });
    }

    // Reschedule with an alternate qualified faculty or after-return day
    const altDays: DayOfWeek[] = DAYS_OF_WEEK.filter((d) => d !== session.day);
    let foundReschedule = false;
    for (const d of altDays) {
      if (foundReschedule) break;
      for (const t of TIME_SLOTS) {
        const roomFree = !isRoomBusyAt(originalRoom.id, d, t, state, session.id) && originalRoom.status === 'Operational';
        const batchFree = !isBatchBusyAt(batch.id, d, t, state, session.id);
        const subFac = state.faculty.find(
          (f) =>
            f.id !== session.facultyId &&
            f.status === 'Operational' &&
            !disabledResourceIds.has(f.id) &&
            facultyMatchesCourse(f.qualifications, course.name, course.department, f.department) &&
            !isFacultyBusyAt(f.id, d, t, state, session.id)
        );
        if (roomFree && batchFree && subFac) {
          foundReschedule = true;
          options.push({
            id: `REC-SLOT-FAC-${session.id}-${d}-${t}`,
            type: 'reschedule_slot',
            title: `Reschedule to ${d} ${t} with ${subFac.name}`,
            subtitle: `Uses ${originalRoom.code} · Zero student or room conflicts`,
            targetResourceId: subFac.id,
            targetDay: d,
            targetTimeSlot: t,
            feasible: true,
            score: 76,
            checks: [
              { label: 'Substitute Free', passed: true, detail: `${subFac.name} available ${d} ${t}` },
              { label: 'Room Free', passed: true, detail: `${originalRoom.code} open` },
              { label: 'Batch Free', passed: true, detail: `${batch.code} has no scheduled class` },
            ],
            summary: `Feasible: Reschedules ${course.code} to ${d} ${t} under ${subFac.name} in ${originalRoom.code}.`,
          });
          break;
        }
      }
    }

    return options.sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.score - a.score);
  }

  // 3. ROOM / LAB / POWER & INTERNET RECOVERY OPTIONS
  const candidateRooms = state.rooms.filter((r) => {
    if (r.id === session.roomId) return false;
    if (course.requiresLab) return r.category === 'lab';
    return true; // Lectures can move to classrooms or large labs if needed, prioritize classrooms
  });

  for (const candidate of candidateRooms) {
    const isOperational =
      candidate.status === 'Operational' && !disabledResourceIds.has(candidate.id);
    const hasCapacity = candidate.capacity >= batch.studentCount;
    const roomTags = getRoomEquipmentTags(candidate, state);

    // Check required equipment (if internet outage disabled Fiber in candidate block, exclude High-Speed Fiber)
    const missingEquipment = course.requiredEquipmentTypes.filter((req) => {
      if (!roomTags.includes(req)) return true;
      // Check if equipment of that type in candidate's block/room is disabled
      const linkedEq = state.equipment.find(
        (eq) =>
          (eq.locationId === candidate.id || eq.locationId === candidate.blockId) &&
          eq.equipmentType === req
      );
      if (linkedEq && (linkedEq.status !== 'Operational' || disabledResourceIds.has(linkedEq.id))) {
        return true;
      }
      return false;
    });

    const hasEquipment = missingEquipment.length === 0;
    const conflict = isRoomBusyAt(candidate.id, session.day, session.timeSlot, state, session.id);
    const noConflict = !conflict;

    const checks: ConstraintCheckResult[] = [
      {
        label: 'Room Status',
        passed: isOperational,
        detail: isOperational
          ? `${candidate.code} (${candidate.blockId}) is Operational`
          : `${candidate.code} is Unavailable (${disabledResourceIds.has(candidate.id) ? 'Outage Zone' : candidate.status})`,
      },
      {
        label: 'Seating Capacity',
        passed: hasCapacity,
        detail: hasCapacity
          ? `Capacity ${candidate.capacity} >= ${batch.studentCount} students`
          : `Capacity ${candidate.capacity} < ${batch.studentCount} students required`,
      },
      {
        label: 'Required Equipment',
        passed: hasEquipment,
        detail: hasEquipment
          ? `All required gear verified (${course.requiredEquipmentTypes.join(', ') || 'Standard'})`
          : `Missing / Offline: ${missingEquipment.join(', ')}`,
      },
      {
        label: 'Timetable Conflict',
        passed: noConflict,
        detail: noConflict
          ? `Free at ${session.day} ${session.timeSlot}`
          : `Occupied by ${conflict?.courseId} (${conflict?.batchId})`,
      },
    ];

    const feasible = isOperational && hasCapacity && hasEquipment && noConflict;
    const isSameTypeBonus = candidate.category === originalRoom.category ? 10 : 0;
    const marginBonus = hasCapacity ? Math.min(10, Math.floor((candidate.capacity - batch.studentCount) / 5)) : 0;

    options.push({
      id: `REC-ROOM-${session.id}-${candidate.id}`,
      type: candidate.category === 'lab' ? 'lab_swap' : 'room_swap',
      title: `Relocate to ${candidate.code} — ${candidate.name}`,
      subtitle: `${candidate.blockId} · Cap ${candidate.capacity} · ${candidate.equipmentTags.slice(0, 2).join(', ')}`,
      targetResourceId: candidate.id,
      feasible,
      score: feasible ? 85 + isSameTypeBonus + marginBonus : 15 + (hasEquipment ? 10 : 0) + (hasCapacity ? 5 : 0),
      checks,
      summary: feasible
        ? `Feasible: ${candidate.code} satisfies capacity (${candidate.capacity}/${batch.studentCount}), equipment, and schedule checks.`
        : `Not Feasible: ${checks
            .filter((c) => !c.passed)
            .map((c) => c.detail)
            .join(' · ')}`,
    });
  }

  // Evaluate Alternate Time-Slot Reschedule (useful especially when specialized equipment is unique to original lab once restored, or all rooms are booked in that slot)
  let slotMatches = 0;
  for (const d of DAYS_OF_WEEK) {
    if (slotMatches >= 2) break;
    for (const t of TIME_SLOTS) {
      if (d === session.day && t === session.timeSlot) continue;

      const facBusy = isFacultyBusyAt(originalFaculty.id, d, t, state, session.id);
      const batchBusy = isBatchBusyAt(batch.id, d, t, state, session.id);
      const facOk = originalFaculty.status === 'Operational' && !disabledResourceIds.has(originalFaculty.id);

      if (facBusy || batchBusy || !facOk) continue;

      // Find an operational, equipped room free at (d, t)
      const freeAltRoom = state.rooms.find((r) => {
        if (disabledResourceIds.has(r.id) || r.status !== 'Operational') return false;
        if (course.requiresLab && r.category !== 'lab') return false;
        if (r.capacity < batch.studentCount) return false;
        const tags = getRoomEquipmentTags(r, state);
        const eqOk = course.requiredEquipmentTypes.every((req) => tags.includes(req));
        if (!eqOk) return false;
        return !isRoomBusyAt(r.id, d, t, state, session.id);
      });

      if (freeAltRoom) {
        slotMatches++;
        options.push({
          id: `REC-SLOT-${session.id}-${d}-${t}-${freeAltRoom.id}`,
          type: 'reschedule_slot',
          title: `Reschedule to ${d} ${t} in ${freeAltRoom.code}`,
          subtitle: `Retains ${originalFaculty.name} · ${freeAltRoom.blockId} (Cap ${freeAltRoom.capacity})`,
          targetResourceId: freeAltRoom.id,
          targetDay: d,
          targetTimeSlot: t,
          feasible: true,
          score: 74,
          checks: [
            { label: 'Room & Equipment', passed: true, detail: `${freeAltRoom.code} operational with required gear` },
            { label: 'Capacity', passed: true, detail: `${freeAltRoom.capacity} >= ${batch.studentCount} students` },
            { label: 'Faculty Free', passed: true, detail: `${originalFaculty.name} free at ${d} ${t}` },
            { label: 'Batch Free', passed: true, detail: `${batch.code} free at ${d} ${t}` },
          ],
          summary: `Feasible: Reschedules ${course.code} to ${d} ${t} in ${freeAltRoom.code} with zero timetable conflicts.`,
        });
        break;
      }
    }
  }

  // If no physical room swap or alternate slot is feasible (e.g., unique Robotics arms or FPGA benches), add a simulation/hybrid fallback option with honest feasibility evaluation
  const anyFeasibleSoFar = options.some((o) => o.feasible);
  if (!anyFeasibleSoFar) {
    const canVirtualize =
      session.sessionType !== 'Practical Assessment' &&
      !course.requiredEquipmentTypes.includes('6-Axis Robotic Arms');
    options.push({
      id: `REC-HYB-ROOM-${session.id}`,
      type: 'hybrid_fallback',
      title: canVirtualize
        ? `Switch to Software Simulation / Virtual Lab Mode`
        : `Defer Hardware Session Pending Maintenance Clearance`,
      subtitle: canVirtualize
        ? `Use cloud/browser HDL or simulation tools in ${batch.code}`
        : `Specialized hardware (${course.requiredEquipmentTypes.join(', ')}) unavailable campus-wide`,
      feasible: canVirtualize,
      score: canVirtualize ? 62 : 5,
      checks: [
        {
          label: 'Physical Hardware Substitution',
          passed: false,
          detail: `No other campus room has ${course.requiredEquipmentTypes.join(', ')}`,
        },
        {
          label: 'Simulation / Remote Viability',
          passed: canVirtualize,
          detail: canVirtualize
            ? 'Theory & software emulation can proceed temporarily'
            : 'Mandatory physical safety cell / assessment cannot be virtualized',
        },
      ],
      summary: canVirtualize
        ? `Feasible Fallback: No physical room carries ${course.requiredEquipmentTypes.join(', ')}; run virtual simulation session until ${originalRoom.code} recovers.`
        : `Not Feasible: Physical hardware (${course.requiredEquipmentTypes.join(', ')}) is unique to ${originalRoom.code} and required for ${session.sessionType}.`,
    });
  }

  return options.sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.score - a.score);
}

export function simulateFailure(req: SimulationRequest, state: CampusState): {
  incident: IncidentRecord;
  nextState: CampusState;
} {
  const disabledIds = new Set<string>();
  const affectedResources: IncidentRecord['affectedResources'] = [];
  let title = '';
  let targetName = '';
  let severity: 'Critical' | 'High' | 'Medium' = 'High';
  const affectedSessionIds = new Map<string, string>(); // sessionId -> impactReason

  const matchesTimeFilter = (s: TimetableSession) =>
    (req.dayFilter === 'ALL' || s.day === req.dayFilter) &&
    (req.timeSlotFilter === 'ALL' || s.timeSlot === req.timeSlotFilter);

  if (req.scenarioType === 'lab_unavailable' || req.scenarioType === 'classroom_unavailable') {
    const room = state.rooms.find((r) => r.id === req.targetId);
    if (!room) throw new Error('Target room/lab not found');
    targetName = `${room.code} — ${room.name}`;
    title = `${room.category === 'lab' ? 'Laboratory Outage' : 'Classroom Unavailable'}: ${room.code}`;
    disabledIds.add(room.id);
    affectedResources.push({
      id: room.id,
      name: targetName,
      category: room.category === 'lab' ? 'Laboratory' : 'Classroom',
      reason: req.notes || 'Marked unavailable during failure simulation',
    });

    // Cascade to equipment inside the room
    for (const eq of state.equipment) {
      if (eq.locationId === room.id) {
        disabledIds.add(eq.id);
        affectedResources.push({
          id: eq.id,
          name: `${eq.code} — ${eq.name}`,
          category: 'Equipment',
          reason: `Inaccessible inside ${room.code}`,
        });
      }
    }

    for (const s of state.timetable) {
      if (s.roomId === room.id && matchesTimeFilter(s)) {
        affectedSessionIds.set(s.id, `Scheduled room ${room.code} is unavailable`);
      }
    }
    severity = room.category === 'lab' ? 'Critical' : 'High';
  } else if (req.scenarioType === 'faculty_absent') {
    const fac = state.faculty.find((f) => f.id === req.targetId);
    if (!fac) throw new Error('Target faculty not found');
    targetName = fac.name;
    title = `Faculty Absence: ${fac.name}`;
    disabledIds.add(fac.id);
    affectedResources.push({
      id: fac.id,
      name: `${fac.name} (${fac.department})`,
      category: 'Faculty',
      reason: req.notes || 'Unplanned absence / unavailable for instruction',
    });

    for (const s of state.timetable) {
      if (s.facultyId === fac.id && matchesTimeFilter(s)) {
        affectedSessionIds.set(s.id, `Assigned instructor ${fac.name} is absent`);
      }
    }
    severity = affectedSessionIds.size >= 3 ? 'Critical' : 'High';
  } else if (req.scenarioType === 'bus_breakdown') {
    const bus = state.buses.find((b) => b.id === req.targetId);
    if (!bus) throw new Error('Target bus not found');
    targetName = `${bus.code} — ${bus.routeName}`;
    title = `Transit Breakdown: ${bus.routeName}`;
    disabledIds.add(bus.id);
    affectedResources.push({
      id: bus.id,
      name: targetName,
      category: 'Bus',
      reason: req.notes || `Mechanical breakdown impacting ${bus.assignedStudentsCount} commuters`,
    });

    // Impacts first-morning slot (08:30–10:00) for all batches served by this bus
    for (const s of state.timetable) {
      if (
        bus.servedBatchIds.includes(s.batchId) &&
        s.timeSlot === '08:30–10:00' &&
        matchesTimeFilter(s)
      ) {
        const batch = state.batches.find((b) => b.id === s.batchId);
        affectedSessionIds.set(
          s.id,
          `${batch?.commuterCount ?? 0} commuters from ${batch?.code} stranded by ${bus.code} breakdown`
        );
      }
    }
    severity = bus.assignedStudentsCount >= 40 ? 'High' : 'Medium';
  } else if (req.scenarioType === 'power_internet_failure') {
    const blockId = req.targetId as CampusBlockId;
    const subType: PowerInternetSubtype = req.subType ?? 'power_and_internet';
    const isCampusWide = blockId === 'CAMPUS-WIDE';
    const block = state.blocks.find((b) => b.id === blockId);
    targetName = isCampusWide ? 'Entire Campus (All Academic Blocks)' : block?.name ?? blockId;

    const subLabel =
      subType === 'power_outage'
        ? 'Power Grid Outage'
        : subType === 'internet_outage'
        ? 'Core Internet / Fiber Failure'
        : 'Power & Internet Infrastructure Failure';
    title = `${subLabel}: ${isCampusWide ? 'Campus-Wide' : block?.shortName ?? blockId}`;
    severity = 'Critical';

    // Identify compromised rooms & equipment
    for (const room of state.rooms) {
      if (!isCampusWide && room.blockId !== blockId) continue;
      if (subType === 'power_outage' || subType === 'power_and_internet') {
        if (!room.hasBackupPower) {
          disabledIds.add(room.id);
          affectedResources.push({
            id: room.id,
            name: `${room.code} — ${room.name}`,
            category: room.category === 'lab' ? 'Laboratory' : 'Classroom',
            reason: `No backup power in ${room.blockId} during ${subLabel}`,
          });
        }
      }
    }

    for (const eq of state.equipment) {
      if (!isCampusWide && eq.blockId !== blockId) continue;
      const hitByPower =
        (subType === 'power_outage' || subType === 'power_and_internet') &&
        (eq.requiresGridPower || eq.equipmentType === 'Grid Substation');
      const hitByInternet =
        (subType === 'internet_outage' || subType === 'power_and_internet') && eq.requiresInternet;

      if (hitByPower || hitByInternet) {
        disabledIds.add(eq.id);
        affectedResources.push({
          id: eq.id,
          name: `${eq.code} — ${eq.name}`,
          category: 'Equipment',
          reason: hitByPower
            ? 'Grid power loss'
            : 'Core fiber / network uplink offline',
        });
      }
    }

    for (const s of state.timetable) {
      if (!matchesTimeFilter(s)) continue;
      const room = state.rooms.find((r) => r.id === s.roomId);
      const course = state.courses.find((c) => c.id === s.courseId);
      if (!room || !course) continue;
      if (!isCampusWide && room.blockId !== blockId) continue;

      if (disabledIds.has(room.id)) {
        affectedSessionIds.set(s.id, `${room.code} offline due to ${subLabel} in ${room.blockId}`);
      } else {
        // Room has backup power, or internet-only outage: check if required equipment is offline
        const offlineReq = course.requiredEquipmentTypes.filter((reqType) =>
          state.equipment.some(
            (eq) =>
              disabledIds.has(eq.id) &&
              (eq.locationId === room.id || eq.locationId === room.blockId) &&
              eq.equipmentType === reqType
          )
        );
        if (offlineReq.length > 0) {
          affectedSessionIds.set(
            s.id,
            `Required infrastructure offline (${offlineReq.join(', ')}) during ${subLabel}`
          );
        }
      }
    }
  }

  // Build AffectedOperations + Recovery Options
  const affectedOperations: AffectedOperation[] = [];
  const impactedBatchSet = new Set<string>();
  const impactedFacultySet = new Set<string>();
  let totalImpactedStudents = 0;

  for (const [sessionId, impactReason] of affectedSessionIds.entries()) {
    const session = state.timetable.find((s) => s.id === sessionId);
    if (!session) continue;
    const course = state.courses.find((c) => c.id === session.courseId)!;
    const batch = state.batches.find((b) => b.id === session.batchId)!;
    const fac = state.faculty.find((f) => f.id === session.facultyId)!;
    const room = state.rooms.find((r) => r.id === session.roomId)!;

    if (!impactedBatchSet.has(batch.id)) {
      impactedBatchSet.add(batch.id);
      totalImpactedStudents +=
        req.scenarioType === 'bus_breakdown' ? batch.commuterCount : batch.studentCount;
    }
    impactedFacultySet.add(fac.id);

    const recoveryOptions = evaluateRecoveryOptions(
      session,
      req.scenarioType,
      disabledIds,
      state,
      req.scenarioType === 'bus_breakdown' ? req.targetId : undefined
    );

    affectedOperations.push({
      id: `OP-${Date.now()}-${session.id}`,
      sessionId: session.id,
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      day: session.day,
      timeSlot: session.timeSlot,
      batchId: batch.id,
      batchName: `${batch.code} (${batch.studentCount} students)`,
      studentCount: req.scenarioType === 'bus_breakdown' ? batch.commuterCount : batch.studentCount,
      facultyId: fac.id,
      facultyName: fac.name,
      originalRoomId: room.id,
      originalRoomName: `${room.code} — ${room.name}`,
      sessionType: session.sessionType,
      impactReason,
      severity:
        session.sessionType === 'Practical Assessment'
          ? 'Critical'
          : course.requiresLab
          ? 'High'
          : 'Medium',
      connectedOperations: session.connectedOperations,
      recoveryOptions,
    });
  }

  // Build 4-tier visual cascading chain
  const tier1Items = [
    {
      id: `T1-${req.targetId}`,
      title,
      subtitle: req.notes || `Scope: ${targetName}`,
      severity,
    },
  ];

  const tier2Items = affectedResources.slice(0, 8).map((r) => ({
    id: `T2-${r.id}`,
    title: r.name,
    subtitle: `${r.category} · ${r.reason}`,
    severity: 'High' as const,
  }));

  const tier3Items = affectedOperations.slice(0, 8).map((op) => ({
    id: `T3-${op.id}`,
    title: `${op.courseCode} · ${op.day} ${op.timeSlot}`,
    subtitle: `${op.facultyName} · ${op.originalRoomName}`,
    severity: op.severity,
  }));

  const uniqueConnectedOps = Array.from(
    new Set(affectedOperations.flatMap((op) => op.connectedOperations))
  );
  const tier4Items = [
    ...Array.from(impactedBatchSet).map((bId) => {
      const b = state.batches.find((x) => x.id === bId)!;
      return {
        id: `T4-BAT-${b.id}`,
        title: `Cohort ${b.code} (${req.scenarioType === 'bus_breakdown' ? `${b.commuterCount} commuters` : `${b.studentCount} students`})`,
        subtitle: b.name,
        severity: 'High' as const,
      };
    }),
    ...uniqueConnectedOps.slice(0, 5).map((cop, idx) => ({
      id: `T4-COP-${idx}`,
      title: cop,
      subtitle: 'Downstream operational milestone',
      severity: 'Medium' as const,
    })),
  ];

  const cascadingChain: CascadingTier[] = [
    { tier: 1, label: 'Root Failure Trigger', items: tier1Items },
    {
      tier: 2,
      label: 'Compromised Infrastructure & Assets',
      items:
        tier2Items.length > 0
          ? tier2Items
          : [{ id: 'T2-NONE', title: 'Direct Single-Node Impact', subtitle: targetName, severity: 'Medium' }],
    },
    {
      tier: 3,
      label: 'Disrupted Classes & Faculty',
      items:
        tier3Items.length > 0
          ? tier3Items
          : [{ id: 'T3-NONE', title: 'No Scheduled Classes Hit', subtitle: 'Selected filter window is clear', severity: 'Info' }],
    },
    {
      tier: 4,
      label: 'Impacted Cohorts & Operations',
      items:
        tier4Items.length > 0
          ? tier4Items
          : [{ id: 'T4-NONE', title: 'Zero Downstream Student Disruption', subtitle: 'All cohorts unaffected', severity: 'Info' }],
    },
  ];

  const nowIso = new Date().toISOString();
  const incident: IncidentRecord = {
    id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
    title,
    scenarioType: req.scenarioType,
    subType: req.subType,
    targetId: req.targetId,
    targetName,
    dayFilter: req.dayFilter,
    timeSlotFilter: req.timeSlotFilter,
    notes: req.notes || 'Simulated operational disruption triggered from Failure Simulator.',
    triggeredAt: nowIso,
    status: affectedOperations.length === 0 ? 'Resolved' : 'Active',
    resolvedAt: affectedOperations.length === 0 ? nowIso : undefined,
    severity,
    affectedClassesCount: affectedOperations.length,
    affectedStudentsCount: totalImpactedStudents,
    affectedFacultyCount: impactedFacultySet.size,
    disabledResourceIds: Array.from(disabledIds),
    affectedResources,
    cascadingChain,
    affectedOperations,
    actionLog: [
      {
        timestamp: nowIso,
        message: `Triggered ${title} (${affectedOperations.length} classes, ${totalImpactedStudents} students impacted).`,
      },
    ],
  };

  // Update resource statuses in state
  const nextState: CampusState = {
    ...state,
    rooms: state.rooms.map((r) =>
      disabledIds.has(r.id) ? { ...r, status: 'Unavailable' } : r
    ),
    faculty: state.faculty.map((f) =>
      disabledIds.has(f.id) ? { ...f, status: 'Unavailable' } : f
    ),
    buses: state.buses.map((b) =>
      disabledIds.has(b.id) ? { ...b, status: 'Unavailable' } : b
    ),
    equipment: state.equipment.map((eq) =>
      disabledIds.has(eq.id) ? { ...eq, status: 'Unavailable' } : eq
    ),
    incidents: [incident, ...state.incidents],
  };

  return { incident, nextState };
}

export function applyRecoveryPlan(
  incidentId: string,
  operationId: string,
  optionId: string,
  state: CampusState
): CampusState {
  const incident = state.incidents.find((i) => i.id === incidentId);
  if (!incident) return state;

  const operation = incident.affectedOperations.find((op) => op.id === operationId);
  if (!operation) return state;

  const option = operation.recoveryOptions.find((opt) => opt.id === optionId);
  if (!option || !option.feasible) return state;

  const nowIso = new Date().toISOString();

  // Mutate timetable if room_swap, lab_swap, faculty_swap, or reschedule_slot
  const updatedTimetable = state.timetable.map((session) => {
    if (session.id !== operation.sessionId) return session;
    if (option.type === 'room_swap' || option.type === 'lab_swap') {
      return {
        ...session,
        roomId: option.targetResourceId || session.roomId,
      };
    }
    if (option.type === 'faculty_swap') {
      return {
        ...session,
        facultyId: option.targetResourceId || session.facultyId,
      };
    }
    if (option.type === 'reschedule_slot') {
      return {
        ...session,
        day: option.targetDay || session.day,
        timeSlot: option.targetTimeSlot || session.timeSlot,
        roomId:
          option.targetResourceId && state.rooms.some((r) => r.id === option.targetResourceId)
            ? option.targetResourceId
            : session.roomId,
        facultyId:
          option.targetResourceId && state.faculty.some((f) => f.id === option.targetResourceId)
            ? option.targetResourceId
            : session.facultyId,
      };
    }
    return session;
  });

  const updatedIncidents = state.incidents.map((inc) => {
    if (inc.id !== incidentId) return inc;
    const updatedOps = inc.affectedOperations.map((op) => {
      if (op.id !== operationId) return op;
      return {
        ...op,
        appliedRecovery: {
          optionId: option.id,
          optionType: option.type,
          title: option.title,
          appliedAt: nowIso,
          summary: option.summary,
        },
      };
    });

    const allMitigated = updatedOps.every((op) => Boolean(op.appliedRecovery));
    return {
      ...inc,
      status: allMitigated ? ('Partially Mitigated' as const) : ('Partially Mitigated' as const),
      affectedOperations: updatedOps,
      actionLog: [
        {
          timestamp: nowIso,
          message: `Applied "${option.title}" for ${operation.courseCode} (${operation.day} ${operation.timeSlot}).`,
        },
        ...inc.actionLog,
      ],
    };
  });

  return {
    ...state,
    timetable: updatedTimetable,
    incidents: updatedIncidents,
  };
}

export function resolveAndRestoreIncident(incidentId: string, state: CampusState): CampusState {
  const targetIncident = state.incidents.find((i) => i.id === incidentId);
  if (!targetIncident) return state;

  const nowIso = new Date().toISOString();

  // Compute resources still disabled by OTHER unresolved incidents
  const stillDisabledByOthers = new Set<string>();
  for (const inc of state.incidents) {
    if (inc.id !== incidentId && inc.status !== 'Resolved') {
      for (const rid of inc.disabledResourceIds) {
        stillDisabledByOthers.add(rid);
      }
    }
  }

  const toRestore = new Set(
    targetIncident.disabledResourceIds.filter((id) => !stillDisabledByOthers.has(id))
  );

  return {
    ...state,
    rooms: state.rooms.map((r) => (toRestore.has(r.id) ? { ...r, status: 'Operational' } : r)),
    faculty: state.faculty.map((f) => (toRestore.has(f.id) ? { ...f, status: 'Operational' } : f)),
    buses: state.buses.map((b) => (toRestore.has(b.id) ? { ...b, status: 'Operational' } : b)),
    equipment: state.equipment.map((eq) =>
      toRestore.has(eq.id) ? { ...eq, status: 'Operational' } : eq
    ),
    incidents: state.incidents.map((inc) =>
      inc.id === incidentId
        ? {
            ...inc,
            status: 'Resolved',
            resolvedAt: nowIso,
            actionLog: [
              {
                timestamp: nowIso,
                message: 'Incident marked Resolved and affected campus resources restored to Operational.',
              },
              ...inc.actionLog,
            ],
          }
        : inc
    ),
  };
}
