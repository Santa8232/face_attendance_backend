const router = require('express').Router();
const ctrl   = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login',       ctrl.login);
router.post('/refresh',     ctrl.refreshToken);
router.post('/logout',      authenticate, ctrl.logout);

module.exports = router;
