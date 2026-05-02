const router = require('express').Router();
const ctrl   = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get ('/',        authorize('ADMIN','HR'), ctrl.listShifts);
router.post('/',        authorize('ADMIN'),       ctrl.createShift);
router.post('/assign',  authorize('ADMIN','HR'), ctrl.assignShift);
router.put ('/:id',     authorize('ADMIN'),       ctrl.updateShift);

module.exports = router;
