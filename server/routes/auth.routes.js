'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { body, validationResult } = require('express-validator');
const authSvc      = require('../services/auth.service');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { requireAuth } = require('../middleware/auth');
const { loginRateLimit, registerRateLimit, forgotPasswordRateLimit } = require('../middleware/rateLimit');

function getClientUrl(req) {
  if (process.env.CLIENT_URL && !process.env.CLIENT_URL.includes('localhost')) {
    return process.env.CLIENT_URL.replace(/\/$/, '');
  }
  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    if (host && !host.includes('localhost:3002') && !host.includes('127.0.0.1:3002')) {
      return `${proto}://${host}`;
    }
  }
  return (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie('token', accessToken, authSvc.cookieOptions(15 * 60 * 1000));
  res.cookie('accessToken', accessToken, authSvc.cookieOptions(15 * 60 * 1000));
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, authSvc.cookieOptions(7 * 24 * 60 * 60 * 1000));
  }
};

const validate = validations => async (req, res, next) => {
  await Promise.all(validations.map(v => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

// ── Google OAuth Strategy ─────────────────────────────────────────────────────
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
        const avatarUrl = profile.photos?.[0]?.value || null;
        const displayName = profile.displayName || email.split('@')[0];

        if (user) {
          let updated = false;
          if (!user.googleId) { user.googleId = profile.id; updated = true; }
          if (avatarUrl && !user.avatar) { user.avatar = avatarUrl; updated = true; }
          if (!user.name || user.name === 'User') { user.name = displayName; updated = true; }
          if (updated) await user.save();
        } else {
          user = await User.create({
            googleId:      profile.id,
            email,
            name:          displayName,
            avatar:        avatarUrl,
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

// ── GitHub OAuth Strategy ─────────────────────────────────────────────────────
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
        const avatarUrl = profile.photos?.[0]?.value || profile._json?.avatar_url || null;
        const displayName = profile.displayName || profile.username || email.split('@')[0];

        let user = await User.findOne({ $or: [{ githubId: profile.id }, { email }] });
        if (user) {
          let updated = false;
          if (!user.githubId) { user.githubId = profile.id; updated = true; }
          if (avatarUrl && !user.avatar) { user.avatar = avatarUrl; updated = true; }
          if (!user.name || user.name === 'User') { user.name = displayName; updated = true; }
          if (updated) await user.save();
        } else {
          user = await User.create({
            githubId:      profile.id,
            email,
            name:          displayName,
            avatar:        avatarUrl,
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

// ── Google Routes ─────────────────────────────────────────────────────────────
router.get('/google', (req, res, next) => {
  const clientUrl = getClientUrl(req);
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(clientUrl + '/login?error=' + encodeURIComponent('Google OAuth chưa được cấu hình'));
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback',
  (req, res, next) => {
    const clientUrl = getClientUrl(req);
    passport.authenticate('google', { session: false, failureRedirect: clientUrl + '/login?error=google_failed' })(req, res, next);
  },
  async (req, res) => {
    const clientUrl = getClientUrl(req);
    const token = authSvc.signAccessToken(req.user._id);
    const refreshToken = await RefreshToken.createToken(req.user._id, req.ip, req.headers['user-agent']);
    setCookies(res, token, refreshToken);
    res.redirect(`${clientUrl}/dashboard?token=${token}`);
  }
);

// ── GitHub Routes ─────────────────────────────────────────────────────────────
router.get('/github', (req, res, next) => {
  const clientUrl = getClientUrl(req);
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.redirect(clientUrl + '/login?error=' + encodeURIComponent('GitHub OAuth chưa được cấu hình'));
  }
  passport.authenticate('github', { scope: ['user:email'], session: false })(req, res, next);
});

router.get('/github/callback',
  (req, res, next) => {
    const clientUrl = getClientUrl(req);
    passport.authenticate('github', { session: false, failureRedirect: clientUrl + '/login?error=github_failed' })(req, res, next);
  },
  async (req, res) => {
    const clientUrl = getClientUrl(req);
    const token = authSvc.signAccessToken(req.user._id);
    const refreshToken = await RefreshToken.createToken(req.user._id, req.ip, req.headers['user-agent']);
    setCookies(res, token, refreshToken);
    res.redirect(`${clientUrl}/dashboard?token=${token}`);
  }
);

// ── Telegram Routes ───────────────────────────────────────────────────────────
router.get('/telegram/callback', async (req, res) => {
  const clientUrl = getClientUrl(req);
  try {
    const data = req.query;
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const valid = checkTelegramAuth(data, process.env.TELEGRAM_BOT_TOKEN);
      if (!valid) return res.redirect(clientUrl + '/login?error=telegram_auth_invalid');
    }
    const telegramId = data.id;
    if (!telegramId) return res.redirect(clientUrl + '/login?error=no_telegram_id');

    const email = data.username ? (data.username + '@telegram.user') : ('tg_' + telegramId + '@telegram.user');
    const displayName = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || ('Telegram User ' + telegramId);
    const avatarUrl = data.photo_url || null;

    let user = await User.findOne({ $or: [{ telegramId }, { email }] });
    if (user) {
      let updated = false;
      if (!user.telegramId) { user.telegramId = telegramId; updated = true; }
      if (avatarUrl && !user.avatar) { user.avatar = avatarUrl; updated = true; }
      if (!user.name || user.name === 'User') { user.name = displayName; updated = true; }
      if (updated) await user.save();
    } else {
      user = await User.create({
        telegramId,
        email,
        name: displayName,
        avatar: avatarUrl,
        isVerified: true,
        authProvider: 'telegram',
        plan: 'free',
      });
    }

    const token = authSvc.signAccessToken(user._id);
    const refreshToken = await RefreshToken.createToken(user._id, req.ip, req.headers['user-agent']);
    setCookies(res, token, refreshToken);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Đăng nhập thành công</title></head>
        <body style="background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <script>
            if (window.opener) {
              window.opener.location.href = "${clientUrl}/dashboard?token=${token}";
              window.close();
            } else {
              window.location.href = "${clientUrl}/dashboard?token=${token}";
            }
          </script>
          <p>Đăng nhập thành công! Đang chuyển hướng đến Dashboard...</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Telegram auth error:', err);
    res.redirect(clientUrl + '/login?error=telegram_failed');
  }
});

// ── Standard Authentication ───────────────────────────────────────────────────

router.post('/register', registerRateLimit, validate([
  body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
  body('name').optional().trim().isLength({ max: 60 }).withMessage('Tên quá dài'),
]), async (req, res) => {
  try {
    const result = await authSvc.register({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', loginRateLimit, validate([
  body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
  body('password').notEmpty().withMessage('Chưa nhập mật khẩu'),
]), async (req, res) => {
  try {
    const result = await authSvc.login({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (result.requires2FA) {
      return res.json({ success: true, ...result });
    }

    setCookies(res, result.accessToken, result.refreshToken);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const rawAccessToken = req.cookies?.accessToken || req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    let userId = null;
    if (rawAccessToken) {
      try {
        const decoded = authSvc.verifyAccessToken(rawAccessToken);
        userId = decoded.userId || decoded.id;
      } catch (_) {}
    }
    await authSvc.logout(userId, rawRefreshToken);
  } catch (_) {}

  res.clearCookie('token', authSvc.cookieOptions());
  res.clearCookie('accessToken', authSvc.cookieOptions());
  res.clearCookie('refreshToken', authSvc.cookieOptions());
  res.json({ success: true, message: 'Đã đăng xuất' });
});

router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    await authSvc.logoutAll(req.user._id);
    res.clearCookie('token', authSvc.cookieOptions());
    res.clearCookie('accessToken', authSvc.cookieOptions());
    res.clearCookie('refreshToken', authSvc.cookieOptions());
    res.json({ success: true, message: 'Đã đăng xuất khỏi tất cả thiết bị' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!rawRefreshToken) return res.status(401).json({ error: 'Thiếu refresh token', code: 'NO_REFRESH' });

    const result = await authSvc.refreshAccessToken(rawRefreshToken, req.ip, req.headers['user-agent']);
    setCookies(res, result.accessToken, result.refreshToken);
    res.json({ success: true, ...result });
  } catch (err) {
    res.clearCookie('token', authSvc.cookieOptions());
    res.clearCookie('accessToken', authSvc.cookieOptions());
    res.clearCookie('refreshToken', authSvc.cookieOptions());
    res.status(401).json({ error: err.message, code: 'REFRESH_FAILED' });
  }
});

router.post('/forgot-password', forgotPasswordRateLimit, validate([
  body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
]), async (req, res) => {
  try {
    const result = await authSvc.forgotPassword(req.body.email, req.ip);
    res.json(result);
  } catch (_) {
    res.json({ message: 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.' });
  }
});

router.post('/reset-password', validate([
  body('token').notEmpty().withMessage('Thiếu reset token'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu mới tối thiểu 6 ký tự'),
]), async (req, res) => {
  try {
    const result = await authSvc.resetPassword(req.body.token, req.body.password, req.ip);
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

// ── Active Sessions Management ────────────────────────────────────────────────

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await RefreshToken.find({
      userId: req.user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).select('tokenPrefix ip userAgent createdAt expiresAt').sort({ createdAt: -1 }).lean();

    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    await RefreshToken.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { revokedAt: new Date(), revokeReason: 'manual_revoke' }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2FA TOTP Endpoints ────────────────────────────────────────────────────────

router.post('/2fa/setup', requireAuth, async (req, res) => {
  try {
    const data = await authSvc.setup2FA(req.user._id);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/2fa/verify', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Thiếu mã OTP' });
    await authSvc.verify2FA(req.user._id, token, true);
    res.json({ success: true, message: 'Xác thực hai yếu tố (2FA) đã được kích hoạt thành công!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/2fa/disable', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Thiếu mật khẩu xác nhận' });
    await authSvc.disable2FA(req.user._id, password);
    res.json({ success: true, message: 'Xác thực hai yếu tố (2FA) đã được tắt' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/2fa/complete', async (req, res) => {
  try {
    const { userId, challenge, token } = req.body;
    if (!userId || !challenge || !token) return res.status(400).json({ error: 'Thiếu thông tin xác thực 2FA' });

    const result = await authSvc.completeLogin2FA(userId, challenge, token, req.ip, req.headers['user-agent']);
    setCookies(res, result.accessToken, result.refreshToken);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: authSvc.formatUser(req.user) });
});

module.exports = router;
