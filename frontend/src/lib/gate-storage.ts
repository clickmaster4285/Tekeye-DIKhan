/**
 * Gate & Zone persistence via VMS API (database).
 */

import type { Gate, Zone } from "./gate-types";
import { GATE_STORAGE_KEYS } from "./gate-types";
import { fetchVmsJsonBlob, saveVmsJsonBlob } from "@/lib/vms-list-api";

function migrateZone(z: Partial<Zone>): Zone {
  if (z.zone_code != null && typeof z.max_occupancy === "number") return z as Zone;
  return {
    zone_id: z.zone_id ?? `zone-${Date.now()}`,
    zone_name: z.zone_name ?? "",
    zone_code: z.zone_code ?? ((z.zone_id ?? "").slice(0, 10).toUpperCase() || "Z"),
    zone_type: (z.zone_type as Zone["zone_type"]) ?? "Public",
    floor: z.floor ?? "",
    building: z.building ?? "",
    allowed_categories: Array.isArray(z.allowed_categories) ? z.allowed_categories : [],
    max_occupancy: typeof z.max_occupancy === "number" ? z.max_occupancy : 50,
    requires_escort: z.requires_escort ?? false,
    access_hours_start: z.access_hours_start ?? "06:00",
    access_hours_end: z.access_hours_end ?? "22:00",
    weekend_access: z.weekend_access ?? false,
    camera_ids: Array.isArray(z.camera_ids) ? z.camera_ids : [],
    gate_ids: Array.isArray(z.gate_ids) ? z.gate_ids : [],
    zone_active: z.zone_active ?? true,
  };
}

function createDefaultZone(zone_id: string, zone_name: string, zone_code: string): Zone {
  return {
    zone_id,
    zone_name,
    zone_code,
    zone_type: "Public",
    floor: "",
    building: "",
    allowed_categories: [],
    max_occupancy: 50,
    requires_escort: false,
    access_hours_start: "06:00",
    access_hours_end: "22:00",
    weekend_access: false,
    camera_ids: [],
    gate_ids: [],
    zone_active: true,
  };
}

export async function loadGates(): Promise<Gate[]> {
  const gates = await fetchVmsJsonBlob<Gate[]>(GATE_STORAGE_KEYS.GATES, []);
  return Array.isArray(gates) ? gates : [];
}

export async function saveGates(gates: Gate[]): Promise<void> {
  await saveVmsJsonBlob(GATE_STORAGE_KEYS.GATES, gates);
}

export async function loadZones(): Promise<Zone[]> {
  const raw = await fetchVmsJsonBlob<Partial<Zone>[]>(GATE_STORAGE_KEYS.ZONES, []);
  const list = Array.isArray(raw) ? raw : [];
  return list.map((z) => migrateZone(z));
}

export async function saveZones(zones: Zone[]): Promise<void> {
  await saveVmsJsonBlob(GATE_STORAGE_KEYS.ZONES, zones);
}

/** Ensure default zones exist in the database when empty. */
export async function ensureDefaultZones(): Promise<Zone[]> {
  const zones = await loadZones();
  if (zones.length > 0) return zones;
  const defaults: Zone[] = [
    createDefaultZone("zone-main", "Main Entrance", "MAIN"),
    createDefaultZone("zone-warehouse", "Warehouse", "WH"),
    createDefaultZone("zone-admin", "Admin Block", "ADM"),
  ];
  await saveZones(defaults);
  return defaults;
}

/** @deprecated Use loadGates — sync API removed */
export function getGates(): Gate[] {
  return [];
}

/** @deprecated Use saveGates — sync API removed */
export function setGates(_gates: Gate[]): void {
  // no-op
}

/** @deprecated Use loadZones */
export function getZones(): Zone[] {
  return [];
}

/** @deprecated Use saveZones */
export function setZones(_zones: Zone[]): void {
  // no-op
}
