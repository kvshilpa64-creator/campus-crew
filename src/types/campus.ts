export type ResourceStatus = 'Operational' | 'Maintenance' | 'Unavailable';

export type ResourceCategory = 'classroom' | 'lab' | 'faculty' | 'bus' | 'equipment';

export type CampusBlockId = 'BLK-A' | 'BLK-B' | 'BLK-C' | 'CAMPUS-WIDE' | 'TRANSIT';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export type TimeSlotCode =
  | '08:30–10:00'
  | '10:15–11:45'
  | '13:00–14:30'
  | '14:45–16:15';

export interface CampusBlock {
  id: CampusBlockId;
  name: string;
  shortName: string;
  powerSource: string;
  networkNode: string;
}

export interface RoomResource {
  id: string;
  code: string;
  name: string;
  category: 'classroom' | 'lab';
  blockId: CampusBlockId;
  floor: string;
  capacity: number;
  status: ResourceStatus;
  equipmentTags: string[];
  hasBackupPower: boolean;
  notes?: string;
}

export interface FacultyResource {
  id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  qualifications: string[];
  homeBlock: CampusBlockId;
  status: ResourceStatus;
}

export interface BusResource {
  id: string;
  code: string;
  routeName: string;
  driverName: string;
  capacity: number;
  assignedStudentsCount: number;
  servedBatchIds: string[];
  arrivalWindow: string;
  status: ResourceStatus;
}

export interface EquipmentResource {
  id: string;
  code: string;
  name: string;
  equipmentType: string;
  locationId: string;
  locationLabel: string;
  blockId: CampusBlockId;
  requiresGridPower: boolean;
  requiresInternet: boolean;
  status: ResourceStatus;
}

export interface StudentBatch {
  id: string;
  code: string;
  name: string;
  department: string;
  semester: number;
  studentCount: number;
  commuterCount: number;
  primaryBusId?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  department: string;
  requiresLab: boolean;
  requiredEquipmentTypes: string[];
  leadFacultyId: string;
}

export interface TimetableSession {
  id: string;
  day: DayOfWeek;
  timeSlot: TimeSlotCode;
  courseId: string;
  facultyId: string;
  roomId: string;
  batchId: string;
  sessionType: 'Lecture' | 'Laboratory' | 'Practical Assessment';
  connectedOperations: string[];
}

export type FailureScenarioType =
  | 'lab_unavailable'
  | 'faculty_absent'
  | 'bus_breakdown'
  | 'classroom_unavailable'
  | 'power_internet_failure';

export type PowerInternetSubtype = 'power_outage' | 'internet_outage' | 'power_and_internet';

export interface ConstraintCheckResult {
  label: string;
  passed: boolean;
  detail: string;
}

export type RecoveryOptionType =
  | 'room_swap'
  | 'lab_swap'
  | 'faculty_swap'
  | 'reschedule_slot'
  | 'bus_reroute'
  | 'hybrid_fallback';

export interface RecoveryOption {
  id: string;
  type: RecoveryOptionType;
  title: string;
  subtitle: string;
  targetResourceId?: string;
  targetDay?: DayOfWeek;
  targetTimeSlot?: TimeSlotCode;
  feasible: boolean;
  score: number;
  checks: ConstraintCheckResult[];
  summary: string;
}

export interface AppliedRecoveryInfo {
  optionId: string;
  optionType: RecoveryOptionType;
  title: string;
  appliedAt: string;
  summary: string;
}

export interface AffectedOperation {
  id: string;
  sessionId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  day: DayOfWeek;
  timeSlot: TimeSlotCode;
  batchId: string;
  batchName: string;
  studentCount: number;
  facultyId: string;
  facultyName: string;
  originalRoomId: string;
  originalRoomName: string;
  sessionType: 'Lecture' | 'Laboratory' | 'Practical Assessment';
  impactReason: string;
  severity: 'Critical' | 'High' | 'Medium';
  connectedOperations: string[];
  recoveryOptions: RecoveryOption[];
  appliedRecovery?: AppliedRecoveryInfo;
}

export interface CascadingTierItem {
  id: string;
  title: string;
  subtitle: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Info';
}

export interface CascadingTier {
  tier: number;
  label: string;
  items: CascadingTierItem[];
}

export interface IncidentActionLogEntry {
  timestamp: string;
  message: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  scenarioType: FailureScenarioType;
  subType?: PowerInternetSubtype;
  targetId: string;
  targetName: string;
  dayFilter?: DayOfWeek | 'ALL';
  timeSlotFilter?: TimeSlotCode | 'ALL';
  notes: string;
  triggeredAt: string;
  resolvedAt?: string;
  status: 'Active' | 'Partially Mitigated' | 'Resolved';
  severity: 'Critical' | 'High' | 'Medium';
  affectedClassesCount: number;
  affectedStudentsCount: number;
  affectedFacultyCount: number;
  disabledResourceIds: string[];
  affectedResources: {
    id: string;
    name: string;
    category: string;
    reason: string;
  }[];
  cascadingChain: CascadingTier[];
  affectedOperations: AffectedOperation[];
  actionLog: IncidentActionLogEntry[];
}

export interface CampusState {
  blocks: CampusBlock[];
  rooms: RoomResource[];
  faculty: FacultyResource[];
  buses: BusResource[];
  equipment: EquipmentResource[];
  batches: StudentBatch[];
  courses: Course[];
  timetable: TimetableSession[];
  incidents: IncidentRecord[];
}

export type AppModuleId =
  | 'dashboard'
  | 'resources'
  | 'dependencies'
  | 'simulator'
  | 'impact'
  | 'recovery'
  | 'history';
