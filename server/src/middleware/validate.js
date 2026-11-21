import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

/** Runs a chain of express-validator validators and returns a 422 on failure. */
export const validate = (validations) => async (req, _res, next) => {
  try {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const result = validationResult(req);
    if (!result.isEmpty()) {
      const errors = result.array().map((error) => ({ field: error.path, message: error.msg }));
      return next(new ApiError(422, 'Please check the highlighted fields.', errors));
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const objectIdParam = (name = 'id') => ({
  params: {
    [name]: {
      in: ['params'],
      isMongoId: true,
      errorMessage: `Invalid ${name} identifier.`,
    },
  },
});

/**
 * Guards a route so that stock quantities can never be set directly through a
 * general-purpose endpoint. Quantities may only move through the recorded
 * transaction endpoints (stock in / stock out / adjustment / borrow / return).
 */
export function rejectStockFields(...fields) {
  const blocked = fields.length ? fields : ['quantity', 'quantityIn', 'quantityOut', 'stock'];
  return (req, _res, next) => {
    const found = blocked.filter((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
    if (found.length) {
      return next(
        new ApiError(
          400,
          `${found.join(', ')} cannot be set directly. Record the change with a stock transaction so it is logged.`
        )
      );
    }
    next();
  };
}
