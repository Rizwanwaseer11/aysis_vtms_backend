const mongoose = require("mongoose");

/**
 * Attendance shift is started when field user begins work and ends when finished.
 * Admin tracks ONWORK/COMPLETED in attendance page.
 */
const AttendanceShiftSchema = new mongoose.Schema(
  {
    operationType: { type: String, enum: ["GATE","FORK","FLAP","ARM_ROLLER","BULK","GTS","LFS"], required: true },
    shiftType: { type: String, enum: ["MORNING","EVENING","NIGHT"], required: true },

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

    status: { type: String, enum: ["ONWORK","COMPLETED"], default: "ONWORK" },

    start: {
      at: { type: Date, default: Date.now },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      supervisorMediaUrl: { type: String, default: "" },
      driverMediaUrl: { type: String, default: "" }
    },

    end: {
      at: { type: Date, default: null },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      supervisorMediaUrl: { type: String, default: "" },
      driverMediaUrl: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

AttendanceShiftSchema.index({ operationType: 1, "start.at": -1 });
AttendanceShiftSchema.index({ status: 1, "start.at": -1 });
AttendanceShiftSchema.index({ "supervisor.hrNumber": 1, "driver.hrNumber": 1 });

module.exports = mongoose.model("AttendanceShift", AttendanceShiftSchema);
