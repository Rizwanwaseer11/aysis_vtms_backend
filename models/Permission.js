const mongoose = require("mongoose");

const PermissionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // OPERATIONS_APPROVE, OPERATIONS_EDIT ...
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Permission", PermissionSchema);
