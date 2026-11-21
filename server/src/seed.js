import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import { User } from './models/User.js';
import { Category } from './models/Category.js';
import { Place } from './models/Place.js';
import { Item } from './models/Item.js';
import { StockTransaction } from './models/StockTransaction.js';
import { BorrowRecord } from './models/BorrowRecord.js';
import { ActivityLog } from './models/ActivityLog.js';
import { Counter } from './models/Counter.js';
import { Settings } from './models/Settings.js';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days, hour = 9, minute = 15) => {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
};
const daysAhead = (days) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(17, 0, 0, 0);
  return date;
};

/* ---------------------------------------------------------------- accounts --
 * No shared or published credentials are created. The bootstrap administrator
 * is either taken from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (recommended) or
 * generated with a random password that is printed once to the server console.
 * Every other account is created by that administrator inside the application.
 * ------------------------------------------------------------------------- */
const BOOTSTRAP_ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'Laboratory Administrator',
  email: (process.env.SEED_ADMIN_EMAIL || 'lab.admin@cvsu.edu.ph').toLowerCase(),
  password: process.env.SEED_ADMIN_PASSWORD || null,
};

const CATEGORIES = [
  { name: 'Keyboards', description: 'Wired and wireless keyboards for computer laboratory workstations.' },
  { name: 'Mice', description: 'Optical and wireless pointing devices for laboratory units.' },
  { name: 'Monitors', description: 'Display units, monitor stands and video cables for lab workstations.' },
  { name: 'System Units', description: 'Desktop system units, internal storage and memory upgrades.' },
  { name: 'Projectors', description: 'Projectors, screens and presentation accessories for classrooms.' },
  { name: 'Other School Resources', description: 'Consumables and shared school resources used across the laboratory.' },
];

/**
 * Physical storage areas. Item records reference these by name, so the four used
 * below must exist; the rest are ready-to-use options for staff.
 */
const PLACES = [
  { name: 'Computer Laboratory 1', area: 'Laboratories', description: 'Main teaching laboratory for BSIT programming classes.' },
  { name: 'Computer Laboratory 2', area: 'Laboratories', description: 'Multimedia and networking laboratory workstations.' },
  { name: 'AV Room', area: 'Facilities', description: 'Projectors, screens and audio-visual equipment storage.' },
  { name: 'Laboratory Stockroom', area: 'Storage', description: 'Primary stockroom for spare parts and consumables.' },
  { name: 'Supply Room', area: 'Storage', description: 'General school supplies and paper stock.' },
  { name: 'Faculty Room', area: 'Offices', description: 'Equipment issued to and stored for faculty use.' },
  { name: 'Library', area: 'Facilities', description: 'Library computer stations and peripherals.' },
  { name: 'Administrative Office', area: 'Offices', description: 'Office equipment and administrative supplies.' },
];

const ITEMS = [
  {
    name: 'USB Wired Keyboard', category: 'Keyboards', opening: 24, minimumStock: 10, unit: 'pcs',
    location: 'Computer Laboratory 1', condition: 'Good',
    description: 'Standard USB wired keyboard issued with every laboratory workstation.',
    events: [
      { type: 'Stock In', qty: 20, days: 21, supplier: 'CDO Computer Traders', remarks: 'Delivery for the second semester.' },
      { type: 'Stock Out', qty: 9, days: 12, reason: 'Defective unit replacement', remarks: 'Nine units replaced in Laboratory 1.' },
    ],
  },
  {
    name: 'Mechanical Keyboard (RGB)', category: 'Keyboards', opening: 6, minimumStock: 4, unit: 'pcs',
    location: 'Computer Laboratory 2', condition: 'Good',
    description: 'Mechanical keyboard reserved for the programming and multimedia laboratory.',
    events: [{ type: 'Stock In', qty: 6, days: 30, supplier: 'Metro Manila IT Supplies', remarks: 'Procured for the programming laboratory.' }],
  },
  {
    name: 'Wireless Keyboard', category: 'Keyboards', opening: 8, minimumStock: 6, unit: 'pcs',
    location: 'AV Room', condition: 'Good',
    description: '2.4 GHz wireless keyboard used with the presentation cart.',
    events: [{ type: 'Stock Out', qty: 3, days: 9, reason: 'Issued to faculty', remarks: 'Issued for the AV presentation cart.' }],
  },
  {
    name: 'Optical Mouse', category: 'Mice', opening: 30, minimumStock: 12, unit: 'pcs',
    location: 'Computer Laboratory 1', condition: 'Good',
    description: 'USB optical mouse, 1000 DPI, black.',
    events: [
      { type: 'Stock In', qty: 18, days: 18, supplier: 'CDO Computer Traders', remarks: 'Replacement stock for the laboratories.' },
      { type: 'Stock Out', qty: 14, days: 7, reason: 'Laboratory replacement', remarks: 'Replaced double-clicking units in Laboratory 1.' },
    ],
  },
  {
    name: 'Wireless Mouse', category: 'Mice', opening: 10, minimumStock: 8, unit: 'pcs',
    location: 'Computer Laboratory 2', condition: 'Good',
    description: 'Silent 2.4 GHz wireless mouse with USB receiver.',
    events: [{ type: 'Stock Out', qty: 4, days: 5, reason: 'Issued to faculty', remarks: 'Issued to the research laboratory.' }],
  },
  {
    name: 'LED Monitor 19 inch', category: 'Monitors', opening: 20, minimumStock: 6, unit: 'pcs',
    location: 'Computer Laboratory 1', condition: 'Good',
    description: '19-inch LED monitor with HDMI and VGA inputs.',
    events: [
      { type: 'Stock In', qty: 10, days: 24, supplier: 'Metro Manila IT Supplies', remarks: 'Additional monitors for the new workstation row.' },
      { type: 'Stock Out', qty: 12, days: 11, reason: 'New workstation setup', remarks: 'Deployed to the research room workstations.' },
    ],
  },
  {
    name: 'LED Monitor 22 inch', category: 'Monitors', opening: 8, minimumStock: 4, unit: 'pcs',
    location: 'Computer Laboratory 2', condition: 'Good',
    description: '22-inch full-HD monitor for the multimedia laboratory.',
    events: [{ type: 'Stock Out', qty: 5, days: 6, reason: 'Laboratory deployment', remarks: 'Installed in the multimedia laboratory.' }],
  },
  {
    name: 'HDMI Cable 1.5m', category: 'Monitors', opening: 14, minimumStock: 8, unit: 'pcs',
    location: 'AV Room', condition: 'Good',
    description: '1.5 metre HDMI cable for monitors and projectors.',
    events: [
      { type: 'Stock In', qty: 12, days: 16, supplier: 'AV Solutions Philippines', remarks: 'Replacement cables.' },
      { type: 'Stock Out', qty: 16, days: 4, reason: 'Classroom deployment', remarks: 'Distributed to classroom AV sets.' },
    ],
  },
  {
    name: 'System Unit (Core i3, 8GB)', category: 'System Units', opening: 12, minimumStock: 5, unit: 'unit',
    location: 'Computer Laboratory 1', condition: 'Good',
    description: 'Desktop system unit, Core i3-10100, 8GB RAM, 1TB HDD.',
    events: [
      { type: 'Stock In', qty: 6, days: 26, supplier: 'Metro Manila IT Supplies', remarks: 'Additional laboratory units.' },
      { type: 'Stock Out', qty: 9, days: 13, reason: 'Workstation installation', remarks: 'Installed in Computer Laboratory 1.' },
    ],
  },
  {
    name: 'System Unit (Core i5, 16GB)', category: 'System Units', opening: 5, minimumStock: 3, unit: 'unit',
    location: 'Computer Laboratory 2', condition: 'Good',
    description: 'Desktop system unit for software development subjects, Core i5, 16GB RAM, 512GB SSD.',
    events: [{ type: 'Stock Out', qty: 2, days: 8, reason: 'Software laboratory', remarks: 'Deployed to the software engineering laboratory.' }],
  },
  {
    name: 'SSD 480GB SATA', category: 'System Units', opening: 10, minimumStock: 4, unit: 'pcs',
    location: 'Laboratory Stockroom', condition: 'New',
    description: '480GB SATA SSD used to upgrade aging laboratory units.',
    events: [{ type: 'Stock Out', qty: 6, days: 3, reason: 'Unit upgrade', remarks: 'Installed in six laboratory units.' }],
  },
  {
    name: 'Projector (3200 lumens)', category: 'Projectors', opening: 4, minimumStock: 2, unit: 'unit',
    location: 'AV Room', condition: 'Good',
    description: 'HDMI/VGA projector, 3200 lumens, ceiling or cart mount.',
    events: [{ type: 'Stock In', qty: 3, days: 20, supplier: 'AV Solutions Philippines', remarks: 'Procured for the lecture rooms.' }],
  },
  {
    name: 'Projector Screen (Tripod)', category: 'Projectors', opening: 5, minimumStock: 2, unit: 'pcs',
    location: 'AV Room', condition: 'Good',
    description: 'Portable 70-inch tripod projection screen.',
    events: [{ type: 'Stock Out', qty: 1, days: 14, reason: 'Seminar use', remarks: 'Used during the research colloquium.' }],
  },
  {
    name: 'Projector Remote Control', category: 'Projectors', opening: 6, minimumStock: 6, unit: 'pcs',
    location: 'AV Room', condition: 'Good',
    description: 'Replacement remote control compatible with the laboratory projectors.',
    events: [{ type: 'Stock Out', qty: 2, days: 10, reason: 'Replacement', remarks: 'Replaced missing remotes in Rooms 201 and 204.' }],
  },
  {
    name: 'Bond Paper (A4)', category: 'Other School Resources', opening: 60, minimumStock: 25, unit: 'ream',
    location: 'Laboratory Stockroom', condition: 'New',
    description: 'A4 multi-purpose bond paper, 70gsm, 500 sheets per ream.',
    events: [
      { type: 'Stock In', qty: 50, days: 15, supplier: 'National Book Store', remarks: 'Quarterly supply order.' },
      { type: 'Stock Out', qty: 30, days: 2, reason: 'Office request', remarks: 'Issued to the college offices.' },
    ],
  },
  {
    name: 'Whiteboard Marker (box of 12)', category: 'Other School Resources', opening: 18, minimumStock: 10, unit: 'box',
    location: 'Laboratory Stockroom', condition: 'New',
    description: 'Bullet-tip whiteboard markers, black and blue, box of 12.',
    events: [{ type: 'Stock Out', qty: 11, days: 5, reason: 'Faculty distribution', remarks: 'Distributed to laboratory instructors.' }],
  },
  {
    name: 'Printer Ink Cartridge (Black)', category: 'Other School Resources', opening: 9, minimumStock: 6, unit: 'pcs',
    location: 'Laboratory Stockroom', condition: 'New',
    description: 'Black ink cartridge for the laboratory printer.',
    events: [{ type: 'Stock Out', qty: 5, days: 4, reason: 'Printer refill', remarks: 'Used by the laboratory printer.' }],
  },
  {
    name: 'Ethernet Cable Cat6 (3m)', category: 'Other School Resources', opening: 25, minimumStock: 12, unit: 'pcs',
    location: 'Laboratory Stockroom', condition: 'Good',
    description: '3-metre Cat6 patch cable for laboratory network drops.',
    events: [{ type: 'Stock Out', qty: 15, days: 6, reason: 'Network cabling', remarks: 'Replaced damaged patch cables in Laboratory 2.' }],
  },
  {
    name: 'Extension Cord (4-socket)', category: 'Other School Resources', opening: 8, minimumStock: 4, unit: 'pcs',
    location: 'Laboratory Stockroom', condition: 'Good',
    description: '4-socket extension cord with surge protection.',
    events: [{ type: 'Stock Out', qty: 3, days: 7, reason: 'Laboratory setup', remarks: 'Used for the new workstation row.' }],
  },
  {
    name: 'Computer Cleaning Kit', category: 'Other School Resources', opening: 7, minimumStock: 5, unit: 'set',
    location: 'Laboratory Stockroom', condition: 'New',
    description: 'Anti-static brush, microfiber cloth and cleaning solution set.',
    events: [{ type: 'Stock Out', qty: 2, days: 9, reason: 'Maintenance', remarks: 'Quarterly preventive maintenance.' }],
  },
];

const BORROWS = [
  {
    item: 'Projector (3200 lumens)', borrowerName: 'Prof. Elena Santos', borrowerIdNumber: 'FAC-2041', qty: 1,
    days: 2, expectedInDays: 5, returnedDaysAgo: null, remarks: 'Room 204 classroom presentation.',
  },
  {
    item: 'Projector Remote Control', borrowerName: 'BSIT 3-A', borrowerIdNumber: 'SEC-2024-0315', qty: 1,
    days: 1, expectedInDays: 3, returnedDaysAgo: null, remarks: 'Capstone defense presentation.',
  },
  {
    item: 'LED Monitor 19 inch', borrowerName: 'Research Laboratory', borrowerIdNumber: 'LAB-RESEARCH-02', qty: 2,
    days: 12, expectedInDays: -5, returnedDaysAgo: null, remarks: 'Second monitor for the research workstations. Follow up needed.',
  },
  {
    item: 'Extension Cord (4-socket)', borrowerName: 'Prof. Ramon Cruz', borrowerIdNumber: 'FAC-1188', qty: 1,
    days: 20, expectedInDays: -12, returnedDaysAgo: 10, remarks: 'Returned in good condition.',
  },
  {
    item: 'USB Wired Keyboard', borrowerName: 'Multimedia Laboratory', borrowerIdNumber: 'LAB-MM-01', qty: 3,
    days: 25, expectedInDays: -18, returnedDaysAgo: 20, remarks: 'Returned after the seminar.',
  },
  {
    item: 'Projector Screen (Tripod)', borrowerName: 'College Extension Office', borrowerIdNumber: 'OFF-EXT-11', qty: 1,
    days: 28, expectedInDays: -21, returnedDaysAgo: 21, remarks: 'Returned complete with carrying case.',
  },
];

function generatePassword() {
  // 24 random base64url characters — strong and only shown once, in the console.
  return crypto.randomBytes(18).toString('base64url');
}

export async function seedDatabase({ force = false } = {}) {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !force) {
    console.log('Seed skipped: the database already contains accounts.');
    return { seeded: false };
  }

  if (force) {
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Place.deleteMany({}),
      Item.deleteMany({}),
      StockTransaction.deleteMany({}),
      BorrowRecord.deleteMany({}),
      ActivityLog.deleteMany({}),
      Counter.deleteMany({}),
      Settings.deleteMany({}),
    ]);
    console.log('Existing collections cleared for reseeding.');
  }

  // Bootstrap administrator ------------------------------------------------
  const generatedPassword = BOOTSTRAP_ADMIN.password || generatePassword();
  const admin = await User.create({
    name: BOOTSTRAP_ADMIN.name,
    username: BOOTSTRAP_ADMIN.email.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 30) || 'administrator',
    email: BOOTSTRAP_ADMIN.email,
    role: 'Administrator',
    isActive: true,
    passwordHash: await User.hashPassword(generatedPassword),
    passwordChangedAt: new Date(),
  });

  if (!BOOTSTRAP_ADMIN.password) {
    console.log('\n════════════════ ONE-TIME ADMINISTRATOR CREDENTIALS ════════════════');
    console.log(` Sign-in email : ${admin.email}`);
    console.log(` Username      : ${admin.username}`);
    console.log(` Password      : ${generatedPassword}`);
    console.log(' Store this password now — it is shown only once.');
    console.log(' Change it from Settings after signing in, then create the other');
    console.log(' accounts (Inventory Staff, Viewer) in User Management.');
    console.log('════════════════════════════════════════════════════════════════════\n');
  }

  // System settings --------------------------------------------------------
  await Settings.create({ _id: 'system', lowStockThreshold: 10, borrowPeriodDays: 7, updatedBy: admin._id });

  // Categories -------------------------------------------------------------
  const categories = {};
  for (const entry of CATEGORIES) {
    const [category] = await Category.create([{ name: entry.name, description: entry.description, createdBy: admin._id }]);
    categories[entry.name] = category;
  }

  // Storage places ---------------------------------------------------------
  for (const entry of PLACES) {
    await Place.create({ name: entry.name, area: entry.area, description: entry.description, createdBy: admin._id });
  }

  // Items + stock transactions ---------------------------------------------
  const items = {};
  const logs = [];
  let transactionSeq = 0;

  const borrowRefs = BORROWS.map((borrow, index) => ({
    ...borrow,
    reference: `BRW-${String(index + 1).padStart(4, '0')}`,
    dateBorrowed: daysAgo(borrow.days, 10, 0),
    expectedReturnDate: daysAhead(borrow.expectedInDays),
    returned: borrow.returnedDaysAgo !== null,
    actualReturnDate: borrow.returnedDaysAgo !== null ? daysAgo(borrow.returnedDaysAgo, 14, 30) : null,
  }));

  for (let index = 0; index < ITEMS.length; index += 1) {
    const definition = ITEMS[index];
    const itemCode = `INV-${String(index + 1).padStart(4, '0')}`;

    const borrowEvents = borrowRefs
      .filter((borrow) => borrow.item === definition.name)
      .map((borrow) => ({
        ...borrow,
        event: {
          type: 'Borrowed',
          qty: borrow.qty,
          date: borrow.dateBorrowed,
          reason: `Borrowed by ${borrow.borrowerName}`,
          remarks: `Borrow reference ${borrow.reference}.`,
        },
        returnEvent: borrow.returned
          ? {
              type: 'Returned',
              qty: borrow.qty,
              date: borrow.actualReturnDate,
              reason: `Returned by ${borrow.borrowerName}`,
              remarks: `Borrow reference ${borrow.reference}.`,
            }
          : null,
      }));

    const events = [
      ...definition.events.map((event) => ({
        ...event,
        date: daysAgo(event.days, 9 + (index % 7), 10 + (index % 40)),
      })),
      ...borrowEvents.flatMap((borrow) => [borrow.event, ...(borrow.returnEvent ? [borrow.returnEvent] : [])]),
    ].sort((a, b) => a.date - b.date);

    let balance = definition.opening;
    const createdItem = await Item.create({
      itemCode,
      name: definition.name,
      category: categories[definition.category]._id,
      description: definition.description,
      quantity: balance,
      unit: definition.unit,
      minimumStock: definition.minimumStock,
      location: definition.location,
      condition: definition.condition,
      createdBy: admin._id,
      updatedBy: admin._id,
      createdAt: daysAgo(45, 8, 0),
      updatedAt: daysAgo(1, 16, 0),
    });
    items[definition.name] = createdItem;

    // Opening balance is itself a recorded transaction so no quantity change
    // exists without a matching transaction record.
    transactionSeq += 1;
    await StockTransaction.create({
      reference: `TXN-${String(transactionSeq).padStart(5, '0')}`,
      type: 'Stock In',
      item: createdItem._id,
      quantity: definition.opening,
      balanceAfter: definition.opening,
      date: daysAgo(45, 8, 5),
      supplier: 'Opening balance',
      remarks: 'Opening stock recorded when the item was added to the inventory.',
      recordedBy: admin._id,
    });

    for (const event of events) {
      const delta = event.type === 'Stock In' || event.type === 'Returned' ? event.qty : -event.qty;
      balance += delta;
      if (balance < 0) balance = 0;
      transactionSeq += 1;
      await StockTransaction.create({
        reference: `TXN-${String(transactionSeq).padStart(5, '0')}`,
        type: event.type,
        item: createdItem._id,
        quantity: event.qty,
        balanceAfter: balance,
        date: event.date,
        supplier: event.supplier || '',
        reason: event.reason || '',
        remarks: event.remarks || '',
        recordedBy: admin._id,
      });
    }

    createdItem.quantity = balance;
    createdItem.updatedAt = events.length ? events[events.length - 1].date : createdItem.updatedAt;
    await createdItem.save({ validateBeforeSave: false });

    logs.push({
      actor: admin,
      action: 'Added inventory item',
      entityType: 'Item',
      entityId: createdItem._id.toString(),
      entityLabel: `${itemCode} · ${definition.name}`,
      details: `Opening quantity ${definition.opening} ${definition.unit} in ${definition.category}`,
      createdAt: daysAgo(45, 8, 5),
    });
  }

  // Borrow records ---------------------------------------------------------
  for (const borrow of borrowRefs) {
    const item = items[borrow.item];
    const record = await BorrowRecord.create({
      reference: borrow.reference,
      borrowerName: borrow.borrowerName,
      borrowerIdNumber: borrow.borrowerIdNumber,
      item: item._id,
      quantity: borrow.qty,
      dateBorrowed: borrow.dateBorrowed,
      expectedReturnDate: borrow.expectedReturnDate,
      actualReturnDate: borrow.actualReturnDate,
      status: borrow.returned ? 'Returned' : 'Borrowed',
      remarks: borrow.remarks,
      recordedBy: admin._id,
      returnedBy: borrow.returned ? admin._id : null,
    });
    logs.push({
      actor: admin,
      action: 'Recorded borrowed item',
      entityType: 'Borrow',
      entityId: record._id.toString(),
      entityLabel: `${record.reference} · ${item.name}`,
      details: `${borrow.borrowerName} borrowed ${borrow.qty} ${item.unit}`,
      createdAt: daysAgo(borrow.days, 10, 5),
    });
  }

  // Activity logs ----------------------------------------------------------
  const extraLogs = [
    { action: 'Recorded stock in', entityType: 'Item', entityLabel: 'INV-0001 · USB Wired Keyboard', details: 'Stock In of 20 pcs. New balance: 44.', createdAt: daysAgo(21, 11, 20) },
    { action: 'Recorded stock out', entityType: 'Item', entityLabel: 'INV-0015 · Bond Paper (A4)', details: 'Stock Out of 30 reams. New balance: 80.', createdAt: daysAgo(2, 13, 40) },
    { action: 'Updated inventory item', entityType: 'Item', entityLabel: 'INV-0008 · HDMI Cable 1.5m', details: 'Item details updated. Minimum stock level: 8 pcs.', createdAt: daysAgo(4, 15, 10) },
    { action: 'Updated system settings', entityType: 'Settings', entityLabel: 'Inventory settings', details: 'Low-stock default threshold: 10; default borrowing period: 7 day(s)', createdAt: daysAgo(30, 10, 15) },
    { action: 'Recorded returned item', entityType: 'Borrow', entityLabel: 'BRW-0004 · Extension Cord (4-socket)', details: 'Prof. Ramon Cruz returned 1 pcs', createdAt: daysAgo(10, 14, 35) },
    { action: 'Generated inventory report', entityType: 'Report', entityLabel: 'Complete inventory report', details: 'Printed for the quarterly inventory review', createdAt: daysAgo(6, 9, 45) },
  ];

  for (const entry of extraLogs) {
    logs.push({ ...entry, actor: admin, ip: '127.0.0.1', userAgent: 'seed-script' });
  }

  await ActivityLog.insertMany(
    logs.map((entry) => ({
      actor: entry.actor?._id || null,
      actorName: entry.actor?.name || 'System',
      actorUsername: entry.actor?.username || 'system',
      actorRole: entry.actor?.role || '',
      action: entry.action,
      entityType: entry.entityType || '',
      entityId: entry.entityId || '',
      entityLabel: entry.entityLabel || '',
      details: entry.details || '',
      ip: entry.ip || '127.0.0.1',
      userAgent: entry.userAgent || 'seed-script',
      createdAt: entry.createdAt || new Date(),
    }))
  );

  // Keep reference counters ahead of the seeded records.
  await Counter.bulkWrite([
    { updateOne: { filter: { _id: 'itemCode' }, update: { $set: { seq: ITEMS.length } }, upsert: true } },
    { updateOne: { filter: { _id: 'transaction' }, update: { $set: { seq: transactionSeq } }, upsert: true } },
    { updateOne: { filter: { _id: 'borrow' }, update: { $set: { seq: BORROWS.length } }, upsert: true } },
  ]);

  console.log(
    `Seed complete: 1 administrator, ${CATEGORIES.length} categories, ${PLACES.length} places, ${ITEMS.length} items, ${transactionSeq} transactions, ${BORROWS.length} borrow records.`
  );
  return { seeded: true };
}

// Allow running directly: `npm run seed` (optionally with FORCE=1).
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    try {
      await connectDB();
      await seedDatabase({ force: process.env.FORCE === '1' });
      await disconnectDB();
      process.exit(0);
    } catch (error) {
      console.error('Seed failed:', error);
      process.exit(1);
    }
  })();
}
