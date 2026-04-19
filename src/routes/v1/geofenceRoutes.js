const router = require('express').Router();
const ctrl   = require('../../controllers/v1/geofenceController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get  ('/',          authorize('ADMIN','HR'), ctrl.listGeofences);
router.post ('/',          authorize('ADMIN'),       ctrl.createGeofence);
router.put  ('/:id',       authorize('ADMIN'),       ctrl.updateGeofence);
router.post ('/validate',  ctrl.validateGeofence);   // employees can call this

module.exports = router;
