import mongoose from 'mongoose';
import { CONDITIONS, UNITS } from './Item.js';

/**
 * Single-document settings collection (`_id: 'system'`).
 * Holds the system-wide inventory rules that administrators can tune.
 */
const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'system' },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Low-stock threshold cannot be negative'],
      max: [100000, 'Low-stock threshold is too large'],
      validate: { validator: Number.isInteger, message: 'Low-stock threshold must be a whole number' },
    },
    borrowPeriodDays: {
      type: Number,
      default: 7,
      min: [1, 'Default borrowing period must be at least 1 day'],
      max: [180, 'Default borrowing period cannot exceed 180 days'],
      validate: { validator: Number.isInteger, message: 'Borrowing period must be a whole number' },
    },
    units: { type: [String], default: () => [...UNITS] },
    conditions: { type: [String], default: () => [...CONDITIONS] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const Settings = mongoose.model('Settings', settingsSchema);

/** Returns the settings document, creating it with defaults when missing. */
export async function getSettings() {
  const existing = await Settings.findById('system');
  if (existing) return existing;
  return Settings.create({ _id: 'system' });
}

export const SETTINGS_DEFAULTS = { lowStockThreshold: 10, borrowPeriodDays: 7 };
