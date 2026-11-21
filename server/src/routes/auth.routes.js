import { Router } from 'express';
import crypto from 'node:crypto';
import { body } from 'express-validator';
import { User } from '../models/User.js';
import { authenticate, clearAuthCookie, setAuthCookie, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordLimiter,
  loginLimiter,
  resetPasswordLimiter,
  signupLimiter,
} from '../middleware/rateLimit.js';
import { ApiError, asyncHandler, badRequest, conflict, unauthorized } from '../utils/ApiError.js';
import { toUserDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';
import { sendMail } from '../utils/mailer.js';

const router = Router();

const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES) || 30;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN?.split(',')[0]?.trim() || '';

const passwordRules = [
  body('password')
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be between 8 and 72 characters.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number.'),
];

/** SHA-256 of the raw reset token — the raw token never touches the database. */
export function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

/* ------------------------------------------------------------------ login -- */
router.post(
  '/login',
  loginLimiter,
  validate([
    body('username')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Enter your username or email address.')
      .isLength({ max: 120 }),
    body('password').isString().notEmpty().withMessage('Password is required.').isLength({ max: 72 }),
  ]),
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.username || '').toLowerCase().trim();
    const { password } = req.body;

    // Accept either the username or the email address on the account.
    const user = await User.findOne(
      identifier.includes('@') ? { email: identifier } : { username: identifier }
    ).select('+passwordHash +tokenVersion');
    // Never reveal whether the username exists.
    if (!user || !(await user.comparePassword(password))) {
      throw unauthorized('Incorrect username or password.');
    }
    if (!user.isActive) {
      throw new ApiError(403, 'This account has been deactivated. Please contact an administrator.');
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user);
    setAuthCookie(res, token);

    await logActivity({
      req,
      actor: user,
      action: 'Logged in',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: `Signed in as ${user.role}`,
    });

    res.json({ message: `Welcome back, ${user.name.split(' ')[0]}.`, token, user: toUserDTO(user) });
  })
);

/* ----------------------------------------------------------------- signup -- */
router.post(
  '/signup',
  signupLimiter,
  validate([
    body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name.'),
    body('email').isEmail().withMessage('Enter a valid email address.').isLength({ max: 120 }),
    ...passwordRules,
  ]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const { password, confirmPassword } = req.body;

    if (confirmPassword !== undefined && confirmPassword !== password) {
      throw badRequest('The passwords do not match.', [{ field: 'confirmPassword', message: 'Passwords do not match.' }]);
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) throw conflict('An account with that email address already exists.');

    // Derive a unique username from the email local-part: juan.dela -> juan.dela, juan.dela2, ...
    const local = email.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'user';
    let username = local.length >= 3 ? local : `usr-${local}`;
    let suffix = 1;
    while (await User.exists({ username })) {
      suffix += 1;
      username = `${local.slice(0, 24)}${suffix}`;
    }

    // Self-registration always creates the lowest-privilege role. Any `role`
    // value sent by the client is ignored on purpose.
    const user = await User.create({
      name,
      username,
      email,
      role: 'Viewer',
      isActive: true,
      passwordHash: await User.hashPassword(password),
    });

    await logActivity({
      req,
      actor: user,
      action: 'Signed up for an account',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: `Self-registered as Viewer (${email}). An administrator can upgrade the role.`,
    });

    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      message: 'Your account was created with read-only (Viewer) access. An administrator can upgrade your role.',
      token,
      user: toUserDTO(user),
    });
  })
);

/* ---------------------------------------------------------------- logout -- */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await logActivity({
      req,
      actor: req.user,
      action: 'Logged out',
      entityType: 'User',
      entityId: req.user._id.toString(),
      entityLabel: req.user.username,
    });
    clearAuthCookie(res);
    res.json({ message: 'You have been logged out.' });
  })
);

/* -------------------------------------------------------------------- me -- */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) throw unauthorized('Account not found.');
    res.json({ user: toUserDTO(user) });
  })
);

/* --------------------------------------------------------------- profile -- */
router.patch(
  '/profile',
  authenticate,
  validate([
    body('name').optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage('Enter a valid full name.'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email address.'),
  ]),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+tokenVersion');
    const previousEmail = user.email;

    if (req.body.email && req.body.email.toLowerCase() !== previousEmail) {
      const taken = await User.findOne({ _id: { $ne: user._id }, email: req.body.email.toLowerCase() });
      if (taken) throw conflict('Another account already uses that email address.');
    }

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.email !== undefined) user.email = req.body.email;
    await user.save();

    await logActivity({
      req,
      actor: user,
      action: 'Updated own profile',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: 'Profile details changed',
    });
    res.json({ message: 'Profile updated.', user: toUserDTO(user) });
  })
);

/* ------------------------------------------------------- change password -- */
router.post(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword').isString().notEmpty().withMessage('Current password is required.'),
    ...passwordRules,
  ]),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
    const { currentPassword, password: newPassword } = req.body;
    if (!(await user.comparePassword(currentPassword))) {
      throw badRequest('Your current password is incorrect.');
    }
    if (currentPassword === newPassword) {
      throw badRequest('Your new password must be different from the current one.');
    }
    user.passwordHash = await User.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    // Invalidate every other session, then issue a fresh token for this one.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const token = signToken(user);
    setAuthCookie(res, token);

    await logActivity({
      req,
      actor: user,
      action: 'Changed password',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: 'Other active sessions were signed out.',
    });
    res.json({ message: 'Password updated successfully.', token });
  })
);

/* ------------------------------------------------------ forgot password -- */
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate([body('email').isEmail().withMessage('Enter the email address on your account.').isLength({ max: 120 })]),
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').toLowerCase().trim();

    // Generic response regardless of whether the account exists.
    const genericMessage =
      'If an account with that email address exists, a password reset link has been sent. The link expires in 30 minutes.';

    const user = await User.findOne({ email }).select('+resetTokenHash +resetTokenExpiresAt');

    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      user.resetTokenHash = hashResetToken(rawToken);
      user.resetTokenExpiresAt = expiresAt;
      await user.save({ validateBeforeSave: false });

      const origin = CLIENT_ORIGIN || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${origin.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

      await sendMail({
        to: user.email,
        subject: 'Reset your School Inventory System password',
        text: [
          `Hello ${user.name},`,
          '',
          'A password reset was requested for your School Inventory System account.',
          `Open this link within ${RESET_TOKEN_TTL_MINUTES} minutes to choose a new password:`,
          resetUrl,
          '',
          'If you did not request this, you can safely ignore this email — your password will not change.',
        ].join('\n'),
        html: `<p>Hello ${user.name},</p><p>A password reset was requested for your School Inventory System account.</p><p><a href="${resetUrl}">Choose a new password</a> — the link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p><p>If you did not request this, you can safely ignore this email.</p>`,
      });

      await logActivity({
        req,
        actor: user,
        action: 'Requested password reset',
        entityType: 'User',
        entityId: user._id.toString(),
        entityLabel: user.username,
        details: `Reset link issued, expires ${expiresAt.toISOString()}`,
      });
    }

    res.json({ message: genericMessage });
  })
);

/* ------------------------------------------------------- reset password -- */
router.post(
  '/reset-password',
  resetPasswordLimiter,
  validate([
    body('token').isString().trim().isLength({ min: 32, max: 128 }).withMessage('This reset link is not valid.'),
    ...passwordRules,
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== undefined && value !== req.body.password) throw new Error('The passwords do not match.');
        return true;
      })
      .withMessage('The passwords do not match.'),
  ]),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetTokenHash: hashResetToken(token),
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+passwordHash +resetTokenHash +resetTokenExpiresAt +tokenVersion');

    if (!user) {
      throw badRequest('This reset link is invalid or has expired. Please request a new one.');
    }

    const problem = passwordProblem(password);
    if (problem) throw badRequest(problem, [{ field: 'password', message: problem }]);

    user.passwordHash = await User.hashPassword(password);
    user.passwordChangedAt = new Date();
    // Single-use token + invalidate all existing sessions.
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save({ validateBeforeSave: false });

    await logActivity({
      req,
      actor: user,
      action: 'Reset password',
      entityType: 'User',
      entityId: user._id.toString(),
      entityLabel: user.username,
      details: 'Password reset through the emailed single-use link.',
    });

    res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  })
);

export default router;
