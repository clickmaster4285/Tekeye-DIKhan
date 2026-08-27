/**
 * Vehicle Registration & Tracking — database via VMS API.
 */

import type { VehicleEntry, VehicleTrackingRecord } from "./vms-types";
import { VMS_STORAGE_KEYS } from "./vms-types";
import { fetchVmsJsonBlob, saveVmsJsonBlob } from "@/lib/vms-list-api";
import { loadGates } from "./gate-storage";

export async function loadVehicleEntries(): Promise<VehicleEntry[]> {
  const entries = await fetchVmsJsonBlob<VehicleEntry[]>(VMS_STORAGE_KEYS.VEHICLE_ENTRIES, []);
  return Array.isArray(entries) ? entries : [];
}

export async function saveVehicleEntries(entries: VehicleEntry[]): Promise<void> {
  await saveVmsJsonBlob(VMS_STORAGE_KEYS.VEHICLE_ENTRIES, entries);
}

export async function loadVehicleTracking(): Promise<VehicleTrackingRecord[]> {
  const records = await fetchVmsJsonBlob<VehicleTrackingRecord[]>(
    VMS_STORAGE_KEYS.VEHICLE_TRACKING,
    []
  );
  return Array.isArray(records) ? records : [];
}

export async function saveVehicleTracking(records: VehicleTrackingRecord[]): Promise<void> {
  await saveVmsJsonBlob(VMS_STORAGE_KEYS.VEHICLE_TRACKING, records);
}

export async function getGateIdsForVehicle(): Promise<string[]> {
  const gates = await loadGates();
  return gates.filter((g) => g.gate_active).map((g) => g.gate_id);
}

export async function getGateName(gateId: string): Promise<string> {
  const gates = await loadGates();
  return gates.find((g) => g.gate_id === gateId)?.gate_name ?? gateId;
}

/** @deprecated Use loadVehicleEntries */
export function getVehicleEntries(): VehicleEntry[] {
  return [];
}

/** @deprecated Use saveVehicleEntries */
export function setVehicleEntries(_entries: VehicleEntry[]): void {
  // no-op
}

/** @deprecated Use loadVehicleTracking */
export function getVehicleTracking(): VehicleTrackingRecord[] {
  return [];
}

/** @deprecated Use saveVehicleTracking */
export function setVehicleTracking(_records: VehicleTrackingRecord[]): void {
  // no-op
}
