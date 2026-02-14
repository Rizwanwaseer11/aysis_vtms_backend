const router = require("express").Router();
const authJwt = require("../middlewares/authJwt");
const { upload, uploadMedia } = require("../controllers/media.controller");

router.use(authJwt);
router.post("/upload", upload.single("file"), uploadMedia);

module.exports = router;
