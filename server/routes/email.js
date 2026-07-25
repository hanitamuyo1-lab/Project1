const express = require('express');
const { connectEmail } = require('../controllers/emailController');

const router = express.Router();

router.post('/connect-email', connectEmail);

module.exports = router;
