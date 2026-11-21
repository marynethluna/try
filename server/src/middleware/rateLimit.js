import rateLimit from 'express-rate-limit';

/**
 * Rate limiting for the public authentication endpoints.
 * `skipSuccessfulRequests` keeps normal usage from consuming the budget while
 * still slowing down credential-stuffing / token-guessing attempts.
 *
 * Nothing is skipped in production. In development the limiter can be relaxed
 * via RATE_LIMIT_DISABLED=true so an automated acceptance run can repeat the
 * auth flows without locking itself out.
 */
const DISABLED = process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_DISABLED === 'true';

function makeLimiter({ windowMinutes = 15, limit = 20, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip: () => DISABLED,
    message: { message },
  });
}

export const loginLimiter = makeLimiter({
  windowMinutes: 15,
  limit: 20,
  message: 'Too many sign-in attempts. Please try again in a few minutes.',
  skipSuccessfulRequests: true,
});

export const signupLimiter = makeLimiter({
  windowMinutes: 60,
  limit: 10,
  message: 'Too many account requests from this address. Please try again later.',
});

export const forgotPasswordLimiter = makeLimiter({
  windowMinutes: 30,
  limit: 6,
  message: 'Too many password reset requests. Please try again in a few minutes.',
});

export const resetPasswordLimiter = makeLimiter({
  windowMinutes: 30,
  limit: 10,
  message: 'Too many password reset attempts. Please try again in a few minutes.',
});
