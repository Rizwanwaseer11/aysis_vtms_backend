const router = require("express").Router();
const { userLogin, employeeLogin } = require("../controllers/auth.controller");

router.post("/user/login", userLogin);
router.post("/employee/login", employeeLogin);

module.exports = router;
