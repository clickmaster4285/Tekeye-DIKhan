/** One additional person in a group visit (leader is the primary visitor on the form). */

export type GroupVisitMember = {
  name: string
  gender: string
  cnicOrBForm: string
  passportNumber: string
  nationality: string
  dateOfBirth: string
  mobileNumber: string
  emailAddress: string
  residentialAddress: string
  organizationName: string
  designation: string
  photos: string[]
}

export const MIN_GROUP_PARTY_SIZE = 2
export const MAX_GROUP_PARTY_SIZE = 15
export const MAX_GROUP_MEMBER_PHOTOS = 5

export function defaultGroupMember(): GroupVisitMember {
  return {
    name: "",
    gender: "",
    cnicOrBForm: "",
    passportNumber: "",
    nationality: "pakistani",
    dateOfBirth: "",
    mobileNumber: "",
    emailAddress: "",
    residentialAddress: "",
    organizationName: "",
    designation: "",
    photos: [],
  }
}

export function resizeGroupMembers(
  members: GroupVisitMember[],
  partySize: number
): GroupVisitMember[] {
  const extra = Math.max(0, partySize - 1)
  const next = [...members]
  while (next.length < extra) {
    next.push(defaultGroupMember())
  }
  return next.slice(0, extra)
}

export function validateGroupVisit(
  partySize: number,
  members: GroupVisitMember[],
  leaderPhotos: string[]
): string | null {
  if (partySize < MIN_GROUP_PARTY_SIZE) {
    return `A group visit must include at least ${MIN_GROUP_PARTY_SIZE} people.`
  }
  const expectedMembers = partySize - 1
  if (members.length !== expectedMembers) {
    return `Enter details for ${expectedMembers} additional group member(s).`
  }
  if (!leaderPhotos.length) {
    return "Group leader photograph is required."
  }
  for (let i = 0; i < members.length; i++) {
    const m = members[i]
    const label = `Member ${i + 2}`
    if (!m.name?.trim()) return `${label}: full name is required.`
    if (!m.cnicOrBForm?.trim()) return `${label}: CNIC is required.`
    if (!m.mobileNumber?.trim()) return `${label}: mobile number is required.`
    const photos = Array.isArray(m.photos) ? m.photos : []
    if (!photos.length) return `${label}: photograph is required.`
  }
  return null
}

export function buildVisitorQrPayload(input: {
  name?: string
  fullName?: string
  cnic?: string
  cnicNumber?: string
  cnicPassport?: string
  id?: number
  validFrom?: string
  validTo?: string
  timeValidityStart?: string
  timeValidityEnd?: string
  accessZone?: string
  qrCodeId?: string
  visitorRefNumber?: string
  visitDate?: string
  entryGate?: string
  visitPurpose?: string
  department?: string
  visitMode?: string
  groupPartySize?: number
  groupMembers?: GroupVisitMember[]
  groupId?: string
  mobileNumber?: string
}): string {
  const validFrom = (input.validFrom ?? input.timeValidityStart ?? "00:00").trim() || "00:00"
  const validTo = (input.validTo ?? input.timeValidityEnd ?? "23:59").trim() || "23:59"
  const base: Record<string, unknown> = {
    name: input.name ?? input.fullName ?? "",
    cnic: input.cnic ?? input.cnicNumber ?? input.cnicPassport ?? "",
    validFrom,
    validTo,
    accessZone: input.accessZone ?? "",
    qrCodeId: input.qrCodeId ?? "",
    visitorRefNumber: input.visitorRefNumber ?? "",
    visitDate: input.visitDate ?? "",
    entryGate: input.entryGate ?? "",
    visitPurpose: input.visitPurpose ?? "",
    department: input.department ?? "",
  }
  if (input.id != null) base.id = input.id
  if (input.visitMode === "group") {
    const meta = buildGroupQrMeta(
      {
        fullName: String(base.name),
        cnicNumber: String(base.cnic),
        mobileNumber: input.mobileNumber,
      },
      input.groupPartySize ?? MIN_GROUP_PARTY_SIZE,
      input.groupMembers ?? [],
      input.groupId ?? input.qrCodeId
    )
    return JSON.stringify({ ...base, ...meta })
  }
  return JSON.stringify(base)
}

export function buildGroupQrMeta(
  leader: {
    fullName?: string
    cnicNumber?: string
    mobileNumber?: string
  },
  partySize: number,
  members: GroupVisitMember[],
  groupId?: string
) {
  const id =
    groupId?.trim() ||
    `GRP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  return {
    visitMode: "group" as const,
    partySize,
    groupId: id,
    leader: {
      fullName: leader.fullName ?? "",
      cnicNumber: leader.cnicNumber ?? "",
      mobileNumber: leader.mobileNumber ?? "",
    },
    members: members.map((m, i) => ({
      index: i + 2,
      name: m.name,
      cnic: m.cnicOrBForm,
      mobile: m.mobileNumber,
      passport: m.passportNumber,
    })),
  }
}
