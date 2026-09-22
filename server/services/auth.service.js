'use strict';

const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const bcrypt       = require('bcryptjs');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const LoginAttempt = require('../models/LoginAttempt');
const AuditLog     = require('../models/AuditLog');
const emailSvc     = require('./email.service');

let speakeasy, QRCode;
try {
  speakeasy = require('speakeasy');
  QRCode    = require('qrcode');
} catch (_) {}

let ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
let REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (or JWT_SECRET) must be set in production!');
  } else {
    console.warn('[SECURITY WARNING] JWT secrets not configured in environment. Generating dynamic cryptographically secure secrets for development session.');
    if (!ACCESS_SECRET)  ACCESS_SECRET  = crypto.randomBytes(64).toString('hex');
    if (!REFRESH_SECRET) REFRESH_SECRET = crypto.randomBytes(64).toString('hex');
  }
}

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';

// ── Token Generation & Verification ───────────────────────────────────────────

function signAccessToken(userId, extra = {}) {
  return jwt.sign(
    { userId, id: userId, type: 'access', ...extra },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function signToken(userId) {
  return signAccessToken(userId);
}

function generateTokens(userId) {
  const token = signAccessToken(userId);
  const refreshToken = jwt.sign({ userId, id: userId }, REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
  return { token, accessToken: token, refreshToken };
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function cookieOptions(maxAge = 7 * 24 * 60 * 60 * 1000) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge,
    path:     '/',
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path:     '/',
  };
}

// ── Registration ──────────────────────────────────────────────────────────────

// check do manh mk: min 8 ky tu, hoa, thuong, so, ky tu db
function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    throw new Error('Mật khẩu tối thiểu phải từ 8 ký tự');
  }
  const hasUpper   = /[A-Z]/.test(password);
  const hasLower   = /[a-z]/.test(password);
  const hasNumber  = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    throw new Error('Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường, một chữ số và một ký tự đặc biệt');
  }
}

async function register({ email, password, name, ip, userAgent }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) throw new Error('Email không được để trống');

  validatePasswordStrength(password);

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new Error('Email này đã được đăng ký');

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    email: normalizedEmail,
    name:  (name || normalizedEmail.split('@')[0]).trim(),
    password, // hash tu dong qua hook pre-save
    verifyToken,
  });

  // Gửi email xác thực bất đồng bộ (fire-and-forget), không làm nghẽn tiến trình đăng ký của người dùng
  if (emailSvc?.sendVerificationEmail) {
    emailSvc.sendVerificationEmail(normalizedEmail, verifyToken).catch((err) => {
      console.error('[auth] Không thể gửi email xác thực:', err.message);
    });
  }

  await AuditLog.log({
    userId: user._id,
    email: normalizedEmail,
    action: 'register.success',
    severity: 'info',
    ip,
    userAgent,
  });

  const accessToken  = signAccessToken(user._id);
  const refreshToken = await RefreshToken.createToken(user._id, ip, userAgent);

  return { user: formatUser(user), token: accessToken, accessToken, refreshToken };
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function login({ email, password, ip, userAgent }) {
  const normalizedEmail = (email || '').toLowerCase().trim();

  // Check lockout on both Email and IP
  const [emailLock, ipLock] = await Promise.all([
    LoginAttempt.isLocked(normalizedEmail, 'email'),
    LoginAttempt.isLocked(ip || '127.0.0.1', 'ip'),
  ]);

  if (emailLock?.locked || ipLock?.locked) {
    const until = (emailLock?.lockedUntil || ipLock?.lockedUntil);
    const minutesLeft = Math.max(1, Math.ceil((until - Date.now()) / 60000));
    await AuditLog.log({
      email: normalizedEmail,
      action: 'login.blocked_lockout',
      severity: 'warning',
      ip,
      userAgent,
      meta: { until, minutesLeft },
    });
    throw new Error(`Tài khoản tạm thời bị khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`);
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  const validPassword = user && (await user.comparePassword(password));

  if (!user || !validPassword) {
    const [emailResult, ipResult] = await Promise.all([
      LoginAttempt.recordFailed(normalizedEmail, 'email'),
      LoginAttempt.recordFailed(ip || '127.0.0.1', 'ip'),
    ]);

    await AuditLog.log({
      email: normalizedEmail,
      action: 'login.failed',
      severity: 'warning',
      ip,
      userAgent,
      meta: { attemptsLeft: emailResult.remaining },
    });

    if (emailResult.locked || ipResult.locked) {
      throw new Error(`Quá nhiều lần đăng nhập thất bại. Tài khoản bị khóa ${process.env.LOCKOUT_DURATION_MIN || 15} phút.`);
    }

    throw new Error(`Email hoặc mật khẩu không chính xác. Còn ${emailResult.remaining} lần thử.`);
  }

  // Clear failed login attempts on successful login
  await Promise.all([
    LoginAttempt.clear(normalizedEmail, 'email'),
    LoginAttempt.clear(ip || '127.0.0.1', 'ip'),
  ]);

  // Check 2FA
  if (user.twoFactorEnabled) {
    const twoFactorChallenge = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(user._id, {
      twoFactorChallenge,
      twoFactorChallengeExpiry: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
    });

    await AuditLog.log({
      userId: user._id,
      email: normalizedEmail,
      action: 'login.2fa_challenge',
      severity: 'info',
      ip,
      userAgent,
    });

    return { requires2FA: true, userId: user._id.toString(), challenge: twoFactorChallenge };
  }

  user.lastLogin = new Date();
  await user.save();

  await AuditLog.log({
    userId: user._id,
    email: normalizedEmail,
    action: 'login.success',
    severity: 'info',
    ip,
    userAgent,
  });

  const accessToken  = signAccessToken(user._id);
  const refreshToken = await RefreshToken.createToken(user._id, ip, userAgent);

  return { user: formatUser(user), token: accessToken, accessToken, refreshToken };
}

// ── Refresh Access Token ──────────────────────────────────────────────────────

async function refreshAccessToken(rawRefreshToken, ip, userAgent) {
  const tokenDoc = await RefreshToken.verifyToken(rawRefreshToken);
  if (!tokenDoc) {
    throw new Error('Refresh token không hợp lệ hoặc đã hết hạn');
  }

  // Token rotation
  const newRawToken = await RefreshToken.rotateToken(tokenDoc, ip, userAgent);
  if (!newRawToken) {
    await AuditLog.log({
      userId: tokenDoc.userId,
      action: 'token.replay_breach',
      severity: 'critical',
      ip,
      userAgent,
      meta: { family: tokenDoc.family },
    });
    throw new Error('Phát hiện token bất thường (replay attack). Tất cả phiên đăng nhập đã bị vô hiệu để bảo vệ tài khoản.');
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user) throw new Error('Tài khoản không tồn tại');

  const accessToken = signAccessToken(user._id);

  return { user: formatUser(user), token: accessToken, accessToken, refreshToken: newRawToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

async function logout(userId, rawRefreshToken) {
  if (rawRefreshToken) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date(), revokeReason: 'logout' });
  }
  if (userId) {
    await AuditLog.log({ userId, action: 'logout', severity: 'info' });
  }
}

async function logoutAll(userId) {
  await RefreshToken.revokeAllUserTokens(userId, 'logout_all');
  await AuditLog.log({ userId, action: 'logout.all_devices', severity: 'info' });
}

// ── Email Verification ────────────────────────────────────────────────────────

async function verifyEmail(token) {
  const user = await User.findOne({ verifyToken: token });
  if (!user) throw new Error('Token xác thực không hợp lệ hoặc đã hết hạn');

  user.isVerified  = true;
  user.verifyToken = undefined;
  await user.save();

  await AuditLog.log({ userId: user._id, action: 'email.verified', severity: 'info' });
  return { success: true };
}

// ── Password Management ───────────────────────────────────────────────────────

async function forgotPassword(email, ip) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return { message: 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.' };

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken   = resetToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await user.save();

  try {
    if (emailSvc.sendPasswordResetEmail) {
      await emailSvc.sendPasswordResetEmail(user.email, resetToken);
    }
  } catch (err) {
    console.error('[auth] Không thể gửi email đặt lại mật khẩu:', err.message);
  }

  await AuditLog.log({
    userId: user._id,
    email: normalizedEmail,
    action: 'password.reset_requested',
    severity: 'warning',
    ip,
  });

  return { message: 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.' };
}

async function resetPassword(token, newPassword, ip) {
  const user = await User.findOne({
    resetPasswordToken:   token,
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw new Error('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');

  validatePasswordStrength(newPassword);

  user.password             = newPassword;
  user.resetPasswordToken   = undefined;
  user.resetPasswordExpires = undefined;
  user.passwordChangedAt    = new Date(); // huy jwt cu
  await user.save();

  // thu hoi all refresh token khi doi mk
  await RefreshToken.revokeAllUserTokens(user._id, 'password_reset');

  await AuditLog.log({
    userId: user._id,
    action: 'password.reset_completed',
    severity: 'warning',
    ip,
  });

  return { success: true };
}

// ── 2FA TOTP Suite ────────────────────────────────────────────────────────────

async function setup2FA(userId) {
  if (!speakeasy || !QRCode) throw new Error('Thư viện 2FA (speakeasy/qrcode) chưa khả dụng');

  const user = await User.findById(userId);
  if (!user) throw new Error('Người dùng không tồn tại');

  const appName = process.env.TWO_FACTOR_APP_NAME || 'FileTools Pro';
  const secret = speakeasy.generateSecret({
    name: `${appName} (${user.email})`,
    length: 32,
  });

  user.twoFactorTempSecret = secret.base32;
  await user.save();

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  return {
    secret: secret.base32,
    qrCode: qrCodeDataUrl,
    otpauthUrl: secret.otpauth_url,
  };
}

async function verify2FA(userId, token, isSetup = false) {
  if (!speakeasy) throw new Error('Thư viện 2FA chưa khả dụng');
  const user      = await User.findById(userId).select('+twoFactorSecret +twoFactorTempSecret');
  if (!user) throw new Error('Người dùng không tồn tại');

  const secret = isSetup ? user.twoFactorTempSecret : user.twoFactorSecret;
  if (!secret) throw new Error('Chưa thiết lập mã 2FA');

  const valid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(token).trim(),
    window: 2, // Allow +/- 60 seconds clock drift
  });

  if (!valid) throw new Error('Mã OTP không chính xác hoặc đã hết hạn.');

  if (isSetup) {
    user.twoFactorSecret     = secret;
    user.twoFactorTempSecret = null;
    user.twoFactorEnabled    = true;
    await user.save();
    await AuditLog.log({ userId, action: '2fa.enabled', severity: 'warning' });
  }

  return true;
}

async function disable2FA(userId, password) {
  const user = await User.findById(userId).select('+password +twoFactorSecret');
  if (!user) throw new Error('Người dùng không tồn tại');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new Error('Mật khẩu không chính xác');

  user.twoFactorSecret     = null;
  user.twoFactorTempSecret = null;
  user.twoFactorEnabled    = false;
  await user.save();

  await AuditLog.log({ userId, action: '2fa.disabled', severity: 'warning' });
  return { success: true };
}

async function completeLogin2FA(userId, challenge, totpToken, ip, userAgent) {
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user) throw new Error('Tài khoản không tồn tại');

  if (!user.twoFactorChallenge || user.twoFactorChallenge !== challenge) {
    throw new Error('Phiên xác thực 2FA không hợp lệ');
  }
  if (user.twoFactorChallengeExpiry && user.twoFactorChallengeExpiry < new Date()) {
    throw new Error('Phiên xác thực 2FA đã hết hạn. Vui lòng đăng nhập lại.');
  }

  await verify2FA(userId, totpToken, false);

  user.twoFactorChallenge       = null;
  user.twoFactorChallengeExpiry = null;
  user.lastLogin                = new Date();
  await user.save();

  await AuditLog.log({ userId, action: 'login.2fa_success', severity: 'info', ip, userAgent });

  const accessToken  = signAccessToken(user._id);
  const refreshToken = await RefreshToken.createToken(user._id, ip, userAgent);

  return { user: formatUser(user), token: accessToken, accessToken, refreshToken };
}

// ── Format User ───────────────────────────────────────────────────────────────

function formatUser(user) {
  return {
    id:               user._id,
    email:            user.email,
    name:             user.name || (user.email ? user.email.split('@')[0] : 'User'),
    authProvider:     user.authProvider || 'local',
    role:             user.role || 'user',
    plan:             user.plan || 'free',
    isVerified:       user.isVerified,
    twoFactorEnabled: !!user.twoFactorEnabled,
    cloudStorageUsed: user.cloudStorageUsed || 0,
    dailyUsage:       user.dailyUsage,
    createdAt:        user.createdAt,
  };
}

module.exports = {
  signAccessToken,
  signToken,
  generateTokens,
  verifyAccessToken,
  cookieOptions,
  clearCookieOptions,
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  verifyEmail,
  forgotPassword,
  resetPassword,
  setup2FA,
  verify2FA,
  disable2FA,
  completeLogin2FA,
  formatUser,
  validatePasswordStrength,
};
