import { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import {
  BusResource,
  CampusBlockId,
  CampusState,
  EquipmentResource,
  FacultyResource,
  ResourceCategory,
  ResourceStatus,
  RoomResource,
} from '../types/campus';
import { StatusLabel } from './StatusLabel';

interface ResourceManagementViewProps {
  state: CampusState;
  onUpdateState: (updater: (prev: CampusState) => CampusState) => void;
  onSimulateResourceFailure: (category: ResourceCategory, resourceId: string) => void;
}

type CategoryTab = 'all' | ResourceCategory;

interface UnifiedResourceRow {
  id: string;
  code: string;
  name: string;
  category: ResourceCategory;
  categoryLabel: string;
  locationOrDept: string;
  capacityOrMeta: string;
  status: ResourceStatus;
}

export function ResourceManagementView({
  state,
  onUpdateState,
  onSimulateResourceFailure,
}: ResourceManagementViewProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ResourceStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    category: ResourceCategory;
    id: string;
  } | null>(null);

  // Form states for Add / Edit modal
  const [formCategory, setFormCategory] = useState<ResourceCategory>('classroom');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formBlock, setFormBlock] = useState<CampusBlockId>('BLK-A');
  const [formFloor, setFormFloor] = useState('1st Floor');
  const [formCapacity, setFormCapacity] = useState(60);
  const [formStatus, setFormStatus] = useState<ResourceStatus>('Operational');
  const [formTags, setFormTags] = useState('4K Laser Projector, Smart Board');
  const [formBackupPower, setFormBackupPower] = useState(false);
  const [formDept, setFormDept] = useState('Computer Science');
  const [formDesignation, setFormDesignation] = useState('Assistant Professor');
  const [formEmail, setFormEmail] = useState('');
  const [formDriver, setFormDriver] = useState('');
  const [formAssignedStudents, setFormAssignedStudents] = useState(0);
  const [formArrivalWindow, setFormArrivalWindow] = useState('08:10 AM');
  const [formEquipType, setFormEquipType] = useState('GPU Compute Cluster');
  const [formEquipLocation, setFormEquipLocation] = useState('LAB-B1');

  const unifiedRows = useMemo<UnifiedResourceRow[]>(() => {
    const rows: UnifiedResourceRow[] = [];

    for (const r of state.rooms) {
      rows.push({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        categoryLabel: r.category === 'lab' ? 'Laboratory' : 'Classroom',
        locationOrDept: `${r.blockId} · ${r.floor}`,
        capacityOrMeta: `${r.capacity} seats · ${r.equipmentTags.slice(0, 2).join(', ') || 'Standard'}`,
        status: r.status,
      });
    }

    for (const f of state.faculty) {
      rows.push({
        id: f.id,
        code: f.id,
        name: f.name,
        category: 'faculty',
        categoryLabel: 'Faculty',
        locationOrDept: `${f.department} · ${f.designation}`,
        capacityOrMeta: f.qualifications.slice(0, 2).join(', '),
        status: f.status,
      });
    }

    for (const b of state.buses) {
      rows.push({
        id: b.id,
        code: b.code,
        name: b.routeName,
        category: 'bus',
        categoryLabel: 'Bus',
        locationOrDept: `Driver ${b.driverName} · ${b.arrivalWindow}`,
        capacityOrMeta: `${b.assignedStudentsCount}/${b.capacity} seats assigned`,
        status: b.status,
      });
    }

    for (const eq of state.equipment) {
      rows.push({
        id: eq.id,
        code: eq.code,
        name: eq.name,
        category: 'equipment',
        categoryLabel: 'Equipment',
        locationOrDept: `${eq.blockId} · ${eq.locationLabel}`,
        capacityOrMeta: `${eq.equipmentType}${eq.requiresGridPower ? ' · Grid Power' : ''}`,
        status: eq.status,
      });
    }

    return rows;
  }, [state]);

  const filteredRows = useMemo(() => {
    return unifiedRows.filter((row) => {
      if (activeTab !== 'all' && row.category !== activeTab) return false;
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.code.toLowerCase().includes(q) ||
          row.name.toLowerCase().includes(q) ||
          row.locationOrDept.toLowerCase().includes(q) ||
          row.capacityOrMeta.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [unifiedRows, activeTab, statusFilter, searchQuery]);

  const openAddModal = () => {
    setEditingItem(null);
    const defaultCat: ResourceCategory = activeTab === 'all' ? 'classroom' : activeTab;
    setFormCategory(defaultCat);
    setFormCode('');
    setFormName('');
    setFormBlock('BLK-A');
    setFormFloor('1st Floor');
    setFormCapacity(60);
    setFormStatus('Operational');
    setFormTags('4K Laser Projector, Smart Board');
    setFormBackupPower(false);
    setFormDept('Computer Science');
    setFormDesignation('Assistant Professor');
    setFormEmail('');
    setFormDriver('');
    setFormAssignedStudents(0);
    setFormArrivalWindow('08:10 AM');
    setFormEquipType('GPU Compute Cluster');
    setFormEquipLocation(state.rooms[0]?.id ?? 'LAB-B1');
    setModalOpen(true);
  };

  const openEditModal = (category: ResourceCategory, id: string) => {
    setEditingItem({ category, id });
    setFormCategory(category);

    if (category === 'classroom' || category === 'lab') {
      const r = state.rooms.find((x) => x.id === id);
      if (!r) return;
      setFormCode(r.code);
      setFormName(r.name);
      setFormBlock(r.blockId);
      setFormFloor(r.floor);
      setFormCapacity(r.capacity);
      setFormStatus(r.status);
      setFormTags(r.equipmentTags.join(', '));
      setFormBackupPower(r.hasBackupPower);
    } else if (category === 'faculty') {
      const f = state.faculty.find((x) => x.id === id);
      if (!f) return;
      setFormCode(f.id);
      setFormName(f.name);
      setFormDept(f.department);
      setFormDesignation(f.designation);
      setFormEmail(f.email);
      setFormTags(f.qualifications.join(', '));
      setFormBlock(f.homeBlock);
      setFormStatus(f.status);
    } else if (category === 'bus') {
      const b = state.buses.find((x) => x.id === id);
      if (!b) return;
      setFormCode(b.code);
      setFormName(b.routeName);
      setFormDriver(b.driverName);
      setFormCapacity(b.capacity);
      setFormAssignedStudents(b.assignedStudentsCount);
      setFormArrivalWindow(b.arrivalWindow);
      setFormStatus(b.status);
    } else if (category === 'equipment') {
      const eq = state.equipment.find((x) => x.id === id);
      if (!eq) return;
      setFormCode(eq.code);
      setFormName(eq.name);
      setFormEquipType(eq.equipmentType);
      setFormEquipLocation(eq.locationId);
      setFormBlock(eq.blockId);
      setFormStatus(eq.status);
    }

    setModalOpen(true);
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onUpdateState((prev) => {
      if (formCategory === 'classroom' || formCategory === 'lab') {
        const roomId = editingItem ? editingItem.id : `${formCategory === 'lab' ? 'LAB' : 'CR'}-${Date.now().toString().slice(-4)}`;
        const roomObj: RoomResource = {
          id: roomId,
          code: formCode.trim() || roomId,
          name: formName.trim(),
          category: formCategory,
          blockId: formBlock,
          floor: formFloor.trim() || '1st Floor',
          capacity: Math.max(10, Number(formCapacity) || 50),
          status: formStatus,
          equipmentTags: tagsArray,
          hasBackupPower: formBackupPower,
        };
        const exists = prev.rooms.some((r) => r.id === roomId);
        return {
          ...prev,
          rooms: exists
            ? prev.rooms.map((r) => (r.id === roomId ? roomObj : r))
            : [...prev.rooms, roomObj],
        };
      }

      if (formCategory === 'faculty') {
        const facId = editingItem ? editingItem.id : `FAC-${Date.now().toString().slice(-4)}`;
        const facObj: FacultyResource = {
          id: facId,
          name: formName.trim(),
          department: formDept.trim() || 'Computer Science',
          designation: formDesignation.trim() || 'Lecturer',
          email: formEmail.trim() || `${facId.toLowerCase()}@omnis-campus.edu`,
          qualifications: tagsArray.length > 0 ? tagsArray : ['General Core'],
          homeBlock: formBlock,
          status: formStatus,
        };
        const exists = prev.faculty.some((f) => f.id === facId);
        return {
          ...prev,
          faculty: exists
            ? prev.faculty.map((f) => (f.id === facId ? facObj : f))
            : [...prev.faculty, facObj],
        };
      }

      if (formCategory === 'bus') {
        const busId = editingItem ? editingItem.id : `BUS-${Date.now().toString().slice(-4)}`;
        const existing = prev.buses.find((b) => b.id === busId);
        const busObj: BusResource = {
          id: busId,
          code: formCode.trim() || busId,
          routeName: formName.trim(),
          driverName: formDriver.trim() || 'Fleet Driver',
          capacity: Math.max(15, Number(formCapacity) || 50),
          assignedStudentsCount: Math.max(0, Number(formAssignedStudents) || 0),
          servedBatchIds: existing?.servedBatchIds ?? [],
          arrivalWindow: formArrivalWindow.trim() || '08:15 AM',
          status: formStatus,
        };
        return {
          ...prev,
          buses: existing
            ? prev.buses.map((b) => (b.id === busId ? busObj : b))
            : [...prev.buses, busObj],
        };
      }

      // equipment
      const eqId = editingItem ? editingItem.id : `EQ-${Date.now().toString().slice(-4)}`;
      const roomMatch = prev.rooms.find((r) => r.id === formEquipLocation);
      const eqObj: EquipmentResource = {
        id: eqId,
        code: formCode.trim() || eqId,
        name: formName.trim(),
        equipmentType: formEquipType.trim() || 'Lab Hardware',
        locationId: formEquipLocation,
        locationLabel: roomMatch ? `${roomMatch.name} (${roomMatch.code})` : formEquipLocation,
        blockId: roomMatch ? roomMatch.blockId : formBlock,
        requiresGridPower: true,
        requiresInternet: false,
        status: formStatus,
      };
      const exists = prev.equipment.some((x) => x.id === eqId);
      return {
        ...prev,
        equipment: exists
          ? prev.equipment.map((x) => (x.id === eqId ? eqObj : x))
          : [...prev.equipment, eqObj],
      };
    });

    setModalOpen(false);
  };

  const handleCycleStatus = (category: ResourceCategory, id: string, current: ResourceStatus) => {
    const nextStatus: ResourceStatus =
      current === 'Operational'
        ? 'Maintenance'
        : current === 'Maintenance'
        ? 'Unavailable'
        : 'Operational';

    onUpdateState((prev) => ({
      ...prev,
      rooms:
        category === 'classroom' || category === 'lab'
          ? prev.rooms.map((r) => (r.id === id ? { ...r, status: nextStatus } : r))
          : prev.rooms,
      faculty:
        category === 'faculty'
          ? prev.faculty.map((f) => (f.id === id ? { ...f, status: nextStatus } : f))
          : prev.faculty,
      buses:
        category === 'bus'
          ? prev.buses.map((b) => (b.id === id ? { ...b, status: nextStatus } : b))
          : prev.buses,
      equipment:
        category === 'equipment'
          ? prev.equipment.map((e) => (e.id === id ? { ...e, status: nextStatus } : e))
          : prev.equipment,
    }));
  };

  const handleDelete = (category: ResourceCategory, id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      rooms:
        category === 'classroom' || category === 'lab'
          ? prev.rooms.filter((r) => r.id !== id)
          : prev.rooms,
      faculty:
        category === 'faculty' ? prev.faculty.filter((f) => f.id !== id) : prev.faculty,
      buses: category === 'bus' ? prev.buses.filter((b) => b.id !== id) : prev.buses,
      equipment:
        category === 'equipment' ? prev.equipment.filter((e) => e.id !== id) : prev.equipment,
    }));
  };

  const tabs: { id: CategoryTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Resources', count: unifiedRows.length },
    { id: 'classroom', label: 'Classrooms', count: state.rooms.filter((r) => r.category === 'classroom').length },
    { id: 'lab', label: 'Laboratories', count: state.rooms.filter((r) => r.category === 'lab').length },
    { id: 'faculty', label: 'Faculty', count: state.faculty.length },
    { id: 'bus', label: 'Buses', count: state.buses.length },
    { id: 'equipment', label: 'Equipment', count: state.equipment.length },
  ];

  return (
    <div className="space-y-5">
      {/* Filter & Action Toolbar */}
      <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#071020] rounded-lg border border-[#162745]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label} <span className="font-mono tabular-nums opacity-75 ml-1">{tab.count}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Resource</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, name, block, or equipment..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#071020] border border-[#1A2D4F] rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-xs text-slate-400 whitespace-nowrap">
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ResourceStatus)}
              className="px-3 py-2 text-xs bg-[#071020] border border-[#1A2D4F] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Operational">Operational</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>
        </div>
      </div>

      {/* High-Density Resource Inventory Table */}
      <div className="bg-[#0B172D] border border-[#1A2D4F] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1A2D4F] bg-[#081224] text-xs font-medium text-slate-400">
                <th className="py-3 px-4 whitespace-nowrap">Code</th>
                <th className="py-3 px-4 whitespace-nowrap">Resource Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Category</th>
                <th className="py-3 px-4 whitespace-nowrap">Location / Department</th>
                <th className="py-3 px-4 whitespace-nowrap">Capacity & Specs</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152542] text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No campus resources match the active filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={`${row.category}-${row.id}`}
                    className="hover:bg-[#0E1D38] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono tabular-nums text-blue-300 font-medium whitespace-nowrap">
                      {row.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {row.categoryLabel}
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {row.locationOrDept}
                    </td>
                    <td className="py-3 px-4 text-slate-400 tabular-nums max-w-xs truncate">
                      {row.capacityOrMeta}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleCycleStatus(row.category, row.id, row.status)}
                        title="Click to cycle operational status"
                        className="hover:opacity-80 transition-opacity"
                      >
                        <StatusLabel status={row.status} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {row.category !== 'equipment' && (
                          <button
                            type="button"
                            onClick={() => onSimulateResourceFailure(row.category, row.id)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600/30 border border-rose-500/20 rounded transition-colors whitespace-nowrap"
                          >
                            Simulate Failure
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(row.category, row.id)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#16294B] rounded transition-colors"
                          aria-label={`Edit ${row.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.category, row.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#16294B] rounded transition-colors"
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Resource Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#0B172D] border border-[#1E3358] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-[#1A2D4F] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editingItem ? 'Edit Campus Resource' : 'Add Campus Resource'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveResource} className="p-5 space-y-4 text-xs">
              {!editingItem && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Resource Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ResourceCategory)}
                    className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="classroom">Classroom</option>
                    <option value="lab">Laboratory</option>
                    <option value="faculty">Faculty</option>
                    <option value="bus">Campus Bus</option>
                    <option value="equipment">Equipment Asset</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    {formCategory === 'faculty' ? 'ID / Code' : 'Resource Code'}
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder={formCategory === 'lab' ? 'LAB-C3' : 'LH-104'}
                    disabled={Boolean(editingItem && formCategory === 'faculty')}
                    className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ResourceStatus)}
                    className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Operational">Operational</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {formCategory === 'faculty'
                    ? 'Full Name'
                    : formCategory === 'bus'
                    ? 'Route Name'
                    : 'Resource Name'}
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter descriptive name"
                  className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {(formCategory === 'classroom' || formCategory === 'lab') && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">Block</label>
                      <select
                        value={formBlock}
                        onChange={(e) => setFormBlock(e.target.value as CampusBlockId)}
                        className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                      >
                        <option value="BLK-A">Block A</option>
                        <option value="BLK-B">Block B</option>
                        <option value="BLK-C">Block C</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">Floor</label>
                      <input
                        type="text"
                        value={formFloor}
                        onChange={(e) => setFormFloor(e.target.value)}
                        className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">Capacity</label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        value={formCapacity}
                        onChange={(e) => setFormCapacity(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">
                      Installed Equipment (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formBackupPower}
                      onChange={(e) => setFormBackupPower(e.target.checked)}
                      className="rounded border-[#1A2D4F] bg-[#071020]"
                    />
                    <span>Connected to UPS / Diesel Backup Power</span>
                  </label>
                </>
              )}

              {formCategory === 'faculty' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">Department</label>
                      <input
                        type="text"
                        value={formDept}
                        onChange={(e) => setFormDept(e.target.value)}
                        className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">Designation</label>
                      <input
                        type="text"
                        value={formDesignation}
                        onChange={(e) => setFormDesignation(e.target.value)}
                        className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">
                      Subject Qualifications (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                    />
                  </div>
                </>
              )}

              {formCategory === 'bus' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Driver Name</label>
                    <input
                      type="text"
                      value={formDriver}
                      onChange={(e) => setFormDriver(e.target.value)}
                      className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Total Seats</label>
                    <input
                      type="number"
                      min={15}
                      value={formCapacity}
                      onChange={(e) => setFormCapacity(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Assigned</label>
                    <input
                      type="number"
                      min={0}
                      value={formAssignedStudents}
                      onChange={(e) => setFormAssignedStudents(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {formCategory === 'equipment' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Equipment Type</label>
                    <input
                      type="text"
                      value={formEquipType}
                      onChange={(e) => setFormEquipType(e.target.value)}
                      className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Assigned Room</label>
                    <select
                      value={formEquipLocation}
                      onChange={(e) => setFormEquipLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-[#071020] border border-[#1A2D4F] rounded-lg text-white"
                    >
                      {state.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} — {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#1A2D4F] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#112240] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  {editingItem ? 'Save Changes' : 'Create Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
