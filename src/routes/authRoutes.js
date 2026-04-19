const router = require('express').Router();
const { login, register, changePassword } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/login',           login);
router.post('/register',        authenticate, authorize('ADMIN'), register);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
