import mongoose from 'mongoose';

/**
 * A "place" is a physical location / storage area in the school where inventory
 * is kept (Computer Laboratory 1, AV Room, Stock Room, ...). Locations used to
 * be a hardcoded list on the client; they are now real records so staff can
 * maintain them from the app, exactly like categories.
 *
 * `Item.location` stays a string so existing inventory records, reports and CSV
 * exports keep working unchanged — the place name is what gets stored.
 */
const placeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Place name is required'],
      trim: true,
      unique: true,
      minlength: [2, 'Place name must be at least 2 characters'],
      maxlength: [80, 'Place name cannot exceed 80 characters'],
    },
    description: { type: String, trim: true, maxlength: [240, 'Description cannot exceed 240 characters'], default: '' },
    /** Optional grouping so long lists stay readable (e.g. "Laboratories"). */
    area: { type: String, trim: true, maxlength: [60], default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Place = mongoose.model('Place', placeSchema);
