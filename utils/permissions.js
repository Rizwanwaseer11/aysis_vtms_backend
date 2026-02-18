const DESIGNATION_PERMISSION_KEYS = ["READ", "WRITE", "EDIT", "APPROVE", "ALL"];

const USER_PAGE_KEYS = [
  "DASHBOARD",
  "USERS_PAGE",
  "BIN_PAGE",
  "LOCATION_PAGE",
  "ATTENDANCE_PAGE",
  "MANAGEMENT_PAGE",
  "FORK_OPERATION_PAGE",
  "FLAP_OPERATION_PAGE",
  "BULK_OPERATION_PAGE",
  "ARM_ROLLER_OPERATION_PAGE",
  "GATE_OPERATION_PAGE",
  "GTS_OPERATION_PAGE",
  "LFS_OPERATION_PAGE"
];

const USER_PAGE_ALIASES = {
  DASHBOARD: "DASHBOARD",
  USERS: "USERS_PAGE",
  USERSPAGE: "USERS_PAGE",
  USERS_PAGE: "USERS_PAGE",
  BIN: "BIN_PAGE",
  BINPAGE: "BIN_PAGE",
  BINS: "BIN_PAGE",
  BIN_PAGE: "BIN_PAGE",
  LOCATION: "LOCATION_PAGE",
  LOCATIONS: "LOCATION_PAGE",
  LOCATION_PAGE: "LOCATION_PAGE",
  OCATION: "LOCATION_PAGE",
  OCATION_PAGE: "LOCATION_PAGE",
  ATTENDANCE: "ATTENDANCE_PAGE",
  ATTENDANCE_PAGE: "ATTENDANCE_PAGE",
  MANAGEMENT: "MANAGEMENT_PAGE",
  MANAGEMENT_PAGE: "MANAGEMENT_PAGE",
  FORK: "FORK_OPERATION_PAGE",
  FORK_OPERATION: "FORK_OPERATION_PAGE",
  FORK_OPERATION_PAGE: "FORK_OPERATION_PAGE",
  FLAP: "FLAP_OPERATION_PAGE",
  FLAP_OPERATION: "FLAP_OPERATION_PAGE",
  FLAP_OPERATION_PAGE: "FLAP_OPERATION_PAGE",
  BULK: "BULK_OPERATION_PAGE",
  BULK_OPERATION: "BULK_OPERATION_PAGE",
  BULK_OPERATION_PAGE: "BULK_OPERATION_PAGE",
  ARM_ROLLER: "ARM_ROLLER_OPERATION_PAGE",
  ARM_ROLLER_OPERATION: "ARM_ROLLER_OPERATION_PAGE",
  ARM_ROLLER_OPERATION_PAGE: "ARM_ROLLER_OPERATION_PAGE",
  ARM_ROLER_OPERATION: "ARM_ROLLER_OPERATION_PAGE",
  ARM_ROLER_OPERATION_PAGE: "ARM_ROLLER_OPERATION_PAGE",
  GATE: "GATE_OPERATION_PAGE",
  GATE_OPERATION: "GATE_OPERATION_PAGE",
  GATE_OPERATION_PAGE: "GATE_OPERATION_PAGE",
  GTS: "GTS_OPERATION_PAGE",
  GTS_OPERATION: "GTS_OPERATION_PAGE",
  GTS_OPERATION_PAGE: "GTS_OPERATION_PAGE",
  LFS: "LFS_OPERATION_PAGE",
  LFS_OPERATION: "LFS_OPERATION_PAGE",
  LFS_OPERATION_PAGE: "LFS_OPERATION_PAGE"
};

function normalizeKey(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizeKeys(input, allowedSet, aliases = {}) {
  if (!Array.isArray(input)) return { keys: null, invalid: null };
  const keys = [];
  const invalid = [];

  for (const raw of input) {
    const cleaned = normalizeKey(raw);
    if (!cleaned) continue;
    const canonical = aliases[cleaned] || cleaned;
    if (!allowedSet.has(canonical)) {
      invalid.push(canonical);
      continue;
    }
    if (!keys.includes(canonical)) keys.push(canonical);
  }

  return { keys, invalid };
}

function normalizeDesignationPermissions(permissionKeys) {
  const allowedSet = new Set(DESIGNATION_PERMISSION_KEYS);
  return normalizeKeys(permissionKeys, allowedSet);
}

function normalizeUserPagePermissions(pageKeys) {
  const allowedSet = new Set(USER_PAGE_KEYS);
  return normalizeKeys(pageKeys, allowedSet, USER_PAGE_ALIASES);
}

module.exports = {
  DESIGNATION_PERMISSION_KEYS,
  USER_PAGE_KEYS,
  normalizeDesignationPermissions,
  normalizeUserPagePermissions
};
