import { INITIAL_CAMPUS_STATE } from '../data/sampleCampusData';
import { CampusState } from '../types/campus';

const STORAGE_KEY = 'omnisx_campus_digital_twin_v2';

export function loadCampusState(): CampusState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(INITIAL_CAMPUS_STATE);
    }
    const parsed = JSON.parse(raw) as CampusState;
    if (!parsed || !Array.isArray(parsed.rooms) || !Array.isArray(parsed.timetable)) {
      return structuredClone(INITIAL_CAMPUS_STATE);
    }
    return parsed;
  } catch {
    return structuredClone(INITIAL_CAMPUS_STATE);
  }
}

export function saveCampusState(state: CampusState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function resetCampusState(): CampusState {
  const fresh = structuredClone(INITIAL_CAMPUS_STATE);
  saveCampusState(fresh);
  return fresh;
}
