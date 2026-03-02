/**
 * normalize-vehicles.js
 * One-time script to normalize all vehicle numbers to uppercase.
 */
const { connectMongo } = require("../config/db");
const Vehicle = require("../models/Vehicle");

async function normalize() {
  await connectMongo();

  const vehicles = await Vehicle.find({ vehicleNumber: { $exists: true } })
    .select("_id vehicleNumber")
    .lean();

  const bulk = vehicles
    .filter((v) => typeof v.vehicleNumber === "string" && v.vehicleNumber !== v.vehicleNumber.toUpperCase())
    .map((v) => ({
      updateOne: {
        filter: { _id: v._id },
        update: { $set: { vehicleNumber: v.vehicleNumber.toUpperCase() } }
      }
    }));

  if (bulk.length) {
    await Vehicle.bulkWrite(bulk);
  }

  console.log(`Vehicles normalized: ${bulk.length}`);
  process.exit(0);
}

normalize().catch((err) => {
  console.error(err);
  process.exit(1);
});
