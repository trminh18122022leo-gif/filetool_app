'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { body, validationResult } = require('express-validator');
const authSvc = require('../services/auth.service');
const User    = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';

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
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || ((process.env.SERVER_URL || 'http://localhost:3002') + '/api/auth/google/callback'),
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('Google không cung cấp email'));

        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
        if (user) {
          if (!user.googleId) { user.googleId = profile.id; await user.save(); }
        } else {
          user = await User.create({
            googleId:      profile.id,
            email,
            name:          profile.displayName || email.split('@')[0],
            avatar:        profile.photos?.[0]?.value || null,
            isVerified:    true,
            authProvider:  'google',
            plan:          'free',
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    {
      clientID:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:  process.env.GITHUB_CALLBACK_URL || ((process.env.SERVER_URL || 'http://localhost:3002') + '/api/auth/github/callback'),
      scope:        ['user:email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || (profile.username + '@github.user');
        let user = await User.findOne({ $or: [{ githubId: profile.id }, { email }] });
        if (user) {
          if (!user.githubId) { user.githubId = profile.id; await user.save(); }
        } else {
          user = await User.create({
            githubId:      profile.id,
            email,
            name:          profile.displayName || profile.username,
            avatar:        profile.photos?.[0]?.value || null,
            isVerified:    true,
            authProvider:  'github',
            plan:          'free',
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

function checkTelegramAuth(data, botToken) {
  const { hash, ...rest } = data;
  if (!hash || !botToken) return false;
  const checkString = Object.keys(rest)
    .sort()
    .map(k => k + '=' + rest[k])
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  return hmac === hash;
}

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(CLIENT + '/login?error=' + encodeURIComponent('Google OAuth chưa được cấu hình'));
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: CLIENT + '/login?error=google_failed' }),
  (req, res) => {
    const tokens = authSvc.generateTokens ? authSvc.generateTokens(req.user._id) : { token: authSvc.signToken ? authSvc.signToken(req.user._id) : '' };
    const token = tokens.token;
    setCookie(res, token);
    res.redirect(CLIENT + '/dashboard?token=' + token);
  }
);

router.get('/github', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.redirect(CLIENT + '/login?error=' + encodeURIComponent('GitHub OAuth chưa được cấu hình'));
  }
  passport.authenticate('github', { scope: ['user:email'], session: false })(req, res, next);
});

router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: CLIENT + '/login?error=github_failed' }),
  (req, res) => {
    const tokens = authSvc.generateTokens ? authSvc.generateTokens(req.user._id) : { token: authSvc.signToken ? authSvc.signToken(req.user._id) : '' };
    const token = tokens.token;
    setCookie(res, token);
    res.redirect(CLIENT + '/dashboard?token=' + token);
  }
);

router.get('/telegram/callback', async (req, res) => {
  try {
    const data = req.query;
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const valid = checkTelegramAuth(data, process.env.TELEGRAM_BOT_TOKEN);
      if (!valid) return res.redirect(CLIENT + '/login?error=telegram_auth_invalid');
    }
    const telegramId = data.id;
    if (!telegramId) return res.redirect(CLIENT + '/login?error=no_telegram_id');

    const email = data.username ? (data.username + '@telegram.user') : ('tg_' + telegramId + '@telegram.user');
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || ('Telegram User ' + telegramId);

    let user = await User.findOne({ $or: [{ telegramId }, { email }] });
    if (user) {
      if (!user.telegramId) { user.telegramId = telegramId; await user.save(); }
    } else {
      user = await User.create({
        telegramId,
        email,
        name,
        avatar: data.photo_url || null,
        isVerified: true,
        authProvider: 'telegram',
        plan: 'free',
      });
    }

    const tokens = authSvc.generateTokens ? authSvc.generateTokens(user._id) : { token: authSvc.signToken ? authSvc.signToken(user._id) : '' };
    const token = tokens.token;
    setCookie(res, token);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Đăng nhập thành công</title></head>
        <body style="background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <script>
            if (window.opener) {
              window.opener.location.href = "${CLIENT}/dashboard?token=${token}";
              window.close();
            } else {
              window.location.href = "${CLIENT}/dashboard?token=${token}";
            }
          </script>
          <p>Đăng nhập thành công! Đang chuyển hướng đến Dashboard...</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Telegram auth error:', err);
    res.redirect(CLIENT + '/login?error=telegram_failed');
  }
});

router.post('/register', validate([
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
]), async (req, res) => {
  try {
    const result = await authSvc.register(req.body);
    setCookie(res, result.token);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', validate([
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').notEmpty().withMessage('Chưa nhập mật khẩu'),
]), async (req, res) => {
  try {
    const result = await authSvc.login(req.body);
    setCookie(res, result.token);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Đã đăng xuất' });
});

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

router.post('/forgot-password', validate([
  body('email').isEmail().withMessage('Email không hợp lệ'),
]), async (req, res) => {
  const result = await authSvc.forgotPassword(req.body.email);
  res.json(result);
});

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

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: authSvc.formatUser(req.user) });
});

module.exports = router;
