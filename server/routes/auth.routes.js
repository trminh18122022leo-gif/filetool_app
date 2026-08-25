'use strict';

const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const authSvc = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth');

const validate = validations => async (req, res, next) => {
  await Promise.all(validations.map(v => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

const setCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 ngày
  });
};

// Đăng ký
router.post('/register', validate([
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
]), async (req, res, next) => {
  try {
    const result = await authSvc.register(req.body);
    setCookie(res, result.token);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Đăng nhập
router.post('/login', validate([
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').notEmpty().withMessage('Chưa nhập mật khẩu'),
]), async (req, res, next) => {
  try {
    const result = await authSvc.login(req.body);
    setCookie(res, result.token);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Đăng xuất
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Đã đăng xuất' });
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Thiếu refresh token' });
    const result = await authSvc.refreshAccessToken(refreshToken);
    setCookie(res, result.token);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Quên mật khẩu
router.post('/forgot-password', validate([
  body('email').isEmail().withMessage('Email không hợp lệ'),
]), async (req, res) => {
  const result = await authSvc.forgotPassword(req.body.email);
  res.json(result);
});

// Đặt lại mật khẩu
router.post('/reset-password', validate([
  body('token').notEmpty().withMessage('Thiếu reset token'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu mới tối thiểu 6 ký tự'),
]), async (req, res) => {
  try {
    const result = await authSvc.resetPassword(req.body.token, req.body.password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Xác thực email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Thiếu token xác thực' });
    const result = await authSvc.verifyEmail(token);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lấy thông tin user hiện tại
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: authSvc.formatUser(req.user) });
});

module.exports = router;
