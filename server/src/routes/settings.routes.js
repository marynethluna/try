import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/ApiError.js';
import { Settings, getSettings } from '../models/Settings.js';
import { UNITS, CONDITIONS } from '../models/Item.js';
import { logActivity } from '../utils/activity.js';

const router = Router();
router.use(authenticate);

function toSettingsDTO(doc) {
  return {
    lowStockThreshold: doc.lowStockThreshold,
    borrowPeriodDays: doc.borrowPeriodDays,
    units: doc.units?.length ? doc.units : UNITS,
    conditions: doc.conditions?.length ? doc.conditions : CONDITIONS,
    updatedAt: doc.updatedAt,
  };
}

function validateOptionList(field, maxLength) {
  const label = field === 'units' ? 'Units' : 'Conditions';
  return [
    body(field)
      .optional()
      .isArray({ min: 1, max: 50 })
      .withMessage(`${label} must contain between 1 and 50 options.`),
    body(`${field}.*`)
      .isString()
      .trim()
      .isLength({ min: 1, max: maxLength })
      .withMessage(`Each ${field === 'units' ? 'unit' : 'condition'} must be 1–${maxLength} characters.`),
    body(field)
      .optional()
      .custom((values) => {
        if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) return true;
        const normalized = values.map((value) => value.trim().toLocaleLowerCase());
        if (new Set(normalized).size !== values.length) {
          throw new Error(`${label} cannot contain duplicates.`);
        }
        return true;
      }),
  ];
}

/** Every signed-in user needs the threshold to render inventory warnings. */
router.get(
  '/',
  requirePermission('inventory:read'),
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({ settings: toSettingsDTO(settings) });
  })
);

router.patch(
  '/',
  requirePermission('settings:manage'),
  validate([
    body('lowStockThreshold').optional().isInt({ min: 0, max: 100000 }).withMessage('Enter a whole number of 0 or more.'),
    body('borrowPeriodDays').optional().isInt({ min: 1, max: 180 }).withMessage('Enter a whole number between 1 and 180.'),
    ...validateOptionList('units', 20),
    ...validateOptionList('conditions', 50),
  ]),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();

    if (req.body.lowStockThreshold !== undefined) settings.lowStockThreshold = Number(req.body.lowStockThreshold);
    if (req.body.borrowPeriodDays !== undefined) settings.borrowPeriodDays = Number(req.body.borrowPeriodDays);
    if (req.body.units !== undefined) settings.units = req.body.units.map((unit) => unit.trim());
    if (req.body.conditions !== undefined) settings.conditions = req.body.conditions.map((condition) => condition.trim());
    settings.updatedBy = req.user._id;
    await settings.save();

    await logActivity({
      req,
      actor: req.user,
      action: 'Updated system settings',
      entityType: 'Settings',
      entityId: 'system',
      entityLabel: 'Inventory settings',
      details: [
        req.body.lowStockThreshold !== undefined && `Low-stock default threshold: ${settings.lowStockThreshold}`,
        req.body.borrowPeriodDays !== undefined && `Default borrowing period: ${settings.borrowPeriodDays} day(s)`,
        req.body.units !== undefined && `Units of measurement updated (${settings.units.length} options)`,
        req.body.conditions !== undefined && `Item conditions updated (${settings.conditions.length} options)`,
      ].filter(Boolean).join('; '),
    });

    res.json({ message: 'Settings saved.', settings: toSettingsDTO(settings) });
  })
);

/** Applies the system-wide low-stock threshold to every active item. */
router.post(
  '/apply-threshold',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const items = await Settings.db
      .collection('items')
      .updateMany(
        { isActive: true },
        { $set: { minimumStock: settings.lowStockThreshold, updatedAt: new Date() } }
      );

    await logActivity({
      req,
      actor: req.user,
      action: 'Applied low-stock threshold',
      entityType: 'Settings',
      entityId: 'system',
      entityLabel: 'Inventory settings',
      details: `Minimum stock level set to ${settings.lowStockThreshold} for ${items.modifiedCount} item(s).`,
    });

    res.json({
      message: `Minimum stock level updated to ${settings.lowStockThreshold} for ${items.modifiedCount} item(s).`,
      updated: items.modifiedCount,
    });
  })
);

export default router;
