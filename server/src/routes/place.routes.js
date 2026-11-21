import { Router } from 'express';
import { body, param } from 'express-validator';
import { Place } from '../models/Place.js';
import { Item } from '../models/Item.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, conflict, notFound } from '../utils/ApiError.js';
import { toPlaceDTO } from '../utils/serialize.js';
import { logActivity } from '../utils/activity.js';

const router = Router();
router.use(authenticate);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function placesWithStats() {
  const rows = await Place.aggregate([
    { $sort: { name: 1 } },
    {
      $lookup: {
        from: 'items',
        let: { placeName: '$name' },
        pipeline: [
          { $match: { $expr: { $eq: ['$location', '$$placeName'] } } },
          { $project: { quantity: 1 } },
        ],
        as: 'items',
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        area: 1,
        createdAt: 1,
        itemCount: { $size: '$items' },
        totalQuantity: { $sum: '$items.quantity' },
      },
    },
  ]);
  return rows.map((row) => toPlaceDTO(row, row));
}

router.get(
  '/',
  requirePermission('places:read'),
  asyncHandler(async (_req, res) => {
    res.json({ places: await placesWithStats() });
  })
);

router.post(
  '/',
  requirePermission('places:manage'),
  validate([
    body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Place name must be 2–80 characters.'),
    body('description').optional({ values: 'falsy' }).isString().trim().isLength({ max: 240 }),
    body('area').optional({ values: 'falsy' }).isString().trim().isLength({ max: 60 }),
  ]),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name).trim();
    const existing = await Place.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
    if (existing) throw conflict('A place with that name already exists.');

    const place = await Place.create({
      name,
      description: req.body.description || '',
      area: req.body.area || '',
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      actor: req.user,
      action: 'Created place',
      entityType: 'Place',
      entityId: place._id.toString(),
      entityLabel: place.name,
    });

    res.status(201).json({ message: 'Place created.', place: toPlaceDTO(place, { itemCount: 0, totalQuantity: 0 }) });
  })
);

router.patch(
  '/:id',
  requirePermission('places:manage'),
  validate([
    param('id').isMongoId(),
    body('name').optional().isString().trim().isLength({ min: 2, max: 80 }),
    body('description').optional({ values: 'falsy' }).isString().trim().isLength({ max: 240 }),
    body('area').optional({ values: 'falsy' }).isString().trim().isLength({ max: 60 }),
  ]),
  asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id);
    if (!place) throw notFound('Place not found.');

    const previousName = place.name;
    let renamed = false;

    if (req.body.name && req.body.name.trim().toLowerCase() !== place.name.toLowerCase()) {
      const nextName = req.body.name.trim();
      const duplicate = await Place.findOne({
        _id: { $ne: place._id },
        name: new RegExp(`^${escapeRegex(nextName)}$`, 'i'),
      });
      if (duplicate) throw conflict('A place with that name already exists.');
      place.name = nextName;
      renamed = true;
    }
    if (req.body.description !== undefined) place.description = req.body.description;
    if (req.body.area !== undefined) place.area = req.body.area;
    await place.save();

    // Items store the place as a string — keep them in sync when a place is renamed.
    let movedItems = 0;
    if (renamed) {
      const result = await Item.updateMany({ location: previousName }, { $set: { location: place.name } });
      movedItems = result.modifiedCount || 0;
    }

    await logActivity({
      req,
      actor: req.user,
      action: 'Updated place',
      entityType: 'Place',
      entityId: place._id.toString(),
      entityLabel: place.name,
      details: renamed ? `Renamed from "${previousName}"; ${movedItems} item(s) moved.` : undefined,
    });

    const stats = await Item.aggregate([
      { $match: { location: place.name } },
      { $group: { _id: null, itemCount: { $sum: 1 }, totalQuantity: { $sum: '$quantity' } } },
    ]);

    res.json({
      message: renamed && movedItems ? `Place updated. ${movedItems} item(s) now use "${place.name}".` : 'Place updated.',
      place: toPlaceDTO(place, stats[0] || {}),
    });
  })
);

router.delete(
  '/:id',
  requirePermission('places:manage'),
  validate([param('id').isMongoId()]),
  asyncHandler(async (req, res) => {
    const place = await Place.findById(req.params.id);
    if (!place) throw notFound('Place not found.');

    const itemCount = await Item.countDocuments({ location: place.name });
    if (itemCount > 0) {
      throw conflict(
        `This place still holds ${itemCount} inventory item${itemCount === 1 ? '' : 's'}. Move ${itemCount === 1 ? 'it' : 'them'} to another place before deleting.`
      );
    }

    await place.deleteOne();
    await logActivity({
      req,
      actor: req.user,
      action: 'Deleted place',
      entityType: 'Place',
      entityId: place._id.toString(),
      entityLabel: place.name,
    });

    res.json({ message: 'Place deleted.' });
  })
);

export default router;
