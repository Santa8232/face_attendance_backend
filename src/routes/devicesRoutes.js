const router = require('express').Router();
const ctrl   = require('../controllers/deviceController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get   ('/',          authorize('ADMIN','HR'), ctrl.listDevices);
router.post  ('/register',  ctrl.registerDevice);
router.post  ('/rebind',    ctrl.rebindDevice);
router.delete('/:id',       authorize('ADMIN'),      ctrl.untrustDevice);

module.exports = router;
