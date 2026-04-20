const router = require('express').Router();
const ctrl   = require('../../controllers/adminController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get  ('/',          authorize('ADMIN','HR'), ctrl.listGeofences);
router.post ('/',          authorize('ADMIN'),       ctrl.createGeofence);
router.put  ('/:id',       authorize('ADMIN'),       ctrl.updateGeofence);
router.post ('/validate',  ctrl.validateGeofence);

module.exports = router;
