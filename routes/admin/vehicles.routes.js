const router = require('express').Router();
const authJwt = require('../../middlewares/authJwt');
const requireRole = require('../../middlewares/requireRole');
const c = require('../../controllers/admin/vehicles.controller.js');

// Admin-panel routes (EMPLOYEE tokens).
router.use(authJwt);
router.use(requireRole(['VTMS_OFFICER','ADMIN','EMPLOYEE']));

router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
