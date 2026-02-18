const { ok } = require("../../utils/response");
const {
  DESIGNATION_PERMISSION_KEYS,
  USER_PAGE_KEYS,
} = require("../../utils/permissions");

async function list(req, res, next) {
  try {
    return ok(res, "Permissions", {
      designationPermissions: DESIGNATION_PERMISSION_KEYS,
      pagePermissions: USER_PAGE_KEYS,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { list };
