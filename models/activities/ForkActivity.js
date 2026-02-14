const mongoose = require("mongoose");

/**
 * Fork Activity:
 * - Supervisor selects zone/uc/ward and selects a 0.8 bin OR enters manual bin number if not listed
 * - System checks if captured coords are within bin radius => placed=true/false
 */
const Schema = new mongoose.Schema(
  {
operationType: { type: String, required: true },
invoiceNo: { type: String, required: true },
monthKey: { type: String, required: true }, // YYYY-MM for fast month filters
status: { type: String, enum: ["PENDING","APPROVED","REJECTED"], default: "PENDING" },

attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceShift", default: null },

supervisor: {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  name: { type: String, default: "" },
  hrNumber: { type: String, default: "" }
},
driver: {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  name: { type: String, default: "" },
  hrNumber: { type: String, default: "" }
},
vehicle: {
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },
  vehicleNumber: { type: String, default: "" },
  vehicleTypeName: { type: String, default: "" },
  ownership: { type: String, default: "" }
},

geo: {
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", default: null },
  zoneName: { type: String, default: "" },
  ucId: { type: mongoose.Schema.Types.ObjectId, ref: "UC", default: null },
  ucName: { type: String, default: "" },
  wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", default: null },
  wardName: { type: String, default: "" }
},

before: {
  at: { type: Date, default: Date.now },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "MediaFile", default: null }
},
after: {
  at: { type: Date, default: null },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "MediaFile", default: null }
},

reviewedBy: {
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  name: { type: String, default: "" },
  at: { type: Date, default: null },
  notes: { type: String, default: "" }
},

notes: { type: String, default: "" },
deletedAt: { type: Date, default: null },
    fork: {
      binId: { type: mongoose.Schema.Types.ObjectId, ref: "Bin08", default: null },
      binNumber: { type: String, default: "" },
      manualBinNumber: { type: String, default: "" },
      radiusM: { type: Number, default: null },
      defaultLat: { type: Number, default: null },
      defaultLng: { type: Number, default: null },
      distanceM: { type: Number, default: null },
      placed: { type: Boolean, default: null }
    }
  },
  { timestamps: true }
);

Schema.index({ status: 1, createdAt: -1 });
Schema.index({ invoiceNo: 1, createdAt: -1 });
Schema.index({ "supervisor.hrNumber": 1, createdAt: -1 });
Schema.index({ "driver.hrNumber": 1, createdAt: -1 });
Schema.index({ "vehicle.vehicleNumber": 1, createdAt: -1 });
Schema.index({ operationType: 1, monthKey: 1, status: 1 });
Schema.index({ operationType: 1, createdAt: -1 });

Schema.index({ "fork.binNumber": 1, createdAt: -1 });
Schema.index({ "geo.wardId": 1, createdAt: -1 });

module.exports = mongoose.model("ForkActivity", Schema);
