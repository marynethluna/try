import { Router } from 'express';
import { query } from 'express-validator';
import { ActivityLog } from '../models/ActivityLog.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/ApiError.js';
import { toLogDTO } from '../utils/serialize.js';
import { buildDateFilter, escapeRegex, parseDateRange, parsePagination } from '../utils/query.js';

const router = Router();
router.use(authenticate);

const ACCOUNT_STATUS_ACTIONS = ['Activated account', 'Deactivated account'];
const ACTION_GROUPS = {
  authentication: ['Logged in', 'Logged out'],
  inventory: [
    'Added inventory item',
    'Updated inventory item',
    'Recorded stock in',
    'Recorded stock out',
    'Archived inventory item',
    'Restored inventory item',
  ],
  borrowing: ['Recorded borrowed item', 'Recorded returned item'],
  'account-management': [
    ...ACCOUNT_STATUS_ACTIONS,
    'Created user account',
    'Updated user account',
    'Reset user password',
    'Signed up for an account',
    'Updated own profile',
    'Changed password',
    'Requested password reset',
    'Reset password',
  ],
  'system-settings': ['Updated system settings', 'Applied low-stock threshold'],
};
const GROUPED_ACTIONS = Object.values(ACTION_GROUPS).flat();
const ACTION_GROUP_IDS = [...Object.keys(ACTION_GROUPS), 'other', 'accountStatus'];

router.get(
  '/',
  requirePermission('logs:read'),
  validate([
    query('search').optional().isString().isLength({ max: 100 }),
    query('actionGroup').optional().isIn(ACTION_GROUP_IDS),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ]),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, 20, 100);
    const { from, to } = parseDateRange(req.query);
    const filter = { ...buildDateFilter(from, to, 'createdAt') };

    if (req.query.actionGroup === 'accountStatus') {
      filter.action = { $in: ACCOUNT_STATUS_ACTIONS };
    } else if (req.query.actionGroup === 'other') {
      filter.action = { $nin: GROUPED_ACTIONS };
    } else if (ACTION_GROUPS[req.query.actionGroup]) {
      filter.action = { $in: ACTION_GROUPS[req.query.actionGroup] };
    }

    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ action: rx }, { actorName: rx }, { actorUsername: rx }, { entityLabel: rx }, { details: rx }];
    }

    const [logs, total, actionRows] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ActivityLog.countDocuments(filter),
      ActivityLog.aggregate([
        {
          $group: {
            _id: {
              $cond: [
                { $in: ['$action', ACCOUNT_STATUS_ACTIONS] },
                'Account status',
                '$action',
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
    ]);

    res.json({
      logs: logs.map(toLogDTO),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      actions: actionRows.map((row) => ({ action: row._id, count: row.count })),
    });
  })
);

export default router;
