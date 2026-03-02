/**
 * normalize-hr.js
 * One-time script to normalize all HR numbers to uppercase for Users and Employees.
 */
const { connectMongo } = require("../config/db");
const User = require("../models/User");
const Employee = require("../models/Employee");

async function normalize() {
  await connectMongo();

  const users = await User.find({ hrNumber: { $exists: true } }).select("_id hrNumber").lean();
  const employees = await Employee.find({ hrNumber: { $exists: true } }).select("_id hrNumber").lean();

  const userBulk = users
    .filter((u) => typeof u.hrNumber === "string" && u.hrNumber !== u.hrNumber.toUpperCase())
    .map((u) => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { hrNumber: u.hrNumber.toUpperCase() } }
      }
    }));

  const employeeBulk = employees
    .filter((e) => typeof e.hrNumber === "string" && e.hrNumber !== e.hrNumber.toUpperCase())
    .map((e) => ({
      updateOne: {
        filter: { _id: e._id },
        update: { $set: { hrNumber: e.hrNumber.toUpperCase() } }
      }
    }));

  if (userBulk.length) {
    await User.bulkWrite(userBulk);
  }
  if (employeeBulk.length) {
    await Employee.bulkWrite(employeeBulk);
  }

  console.log(`Users normalized: ${userBulk.length}`);
  console.log(`Employees normalized: ${employeeBulk.length}`);
  process.exit(0);
}

normalize().catch((err) => {
  console.error(err);
  process.exit(1);
});
