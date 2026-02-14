const router = require("express").Router();
const authJwt = require("../middlewares/authJwt");
const requireRole = require("../middlewares/requireRole");
const c = require("../controllers/chat.controller");

router.use(authJwt);
router.use(requireRole(["SUPERVISOR","DRIVER","ADMIN"]));

router.get("/threads", c.listThreads);
router.get("/threads/:threadId/messages", c.listMessages);

module.exports = router;
