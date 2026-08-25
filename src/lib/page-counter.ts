import mongoose, { Schema, type Model } from "mongoose";

/**
 * Replacement for mongoose-auto-increment-fix, which is unmaintained and does
 * not work on Mongoose 8.
 *
 * The `page` number is the public permalink (`/125`), so this has to reproduce
 * the plugin's semantics exactly and keep writing the same `identitycounters`
 * collection the live database already holds:
 *
 *   { model: "Piece", field: "page", count: <highest assigned> }
 *
 * Two behaviours from the original are load-bearing:
 *
 *   1. A new document with no page gets `count + 1` after an atomic `$inc`,
 *      so the first ever page is 0 (the counter starts at -1).
 *   2. A new document that already carries a page keeps it, and the counter is
 *      dragged up to that value if it was lower — the `count: { $lt: value }`
 *      filter. This is what makes importing documents with explicit page
 *      numbers safe.
 */

const COUNTER_MODEL = "Piece";
const COUNTER_FIELD = "page";
const START_AT = 0;
const INCREMENT_BY = 1;

interface IdentityCounter {
    model: string;
    field: string;
    count: number;
}

const identityCounterSchema = new Schema<IdentityCounter>(
    {
        model: { type: String, required: true },
        field: { type: String, required: true },
        count: { type: Number, default: 0 },
    },
    { collection: "identitycounters" }
);

identityCounterSchema.index({ field: 1, model: 1 }, { unique: true, background: true });

export const IdentityCounterModel: Model<IdentityCounter> =
    (mongoose.models.IdentityCounter as Model<IdentityCounter>) ??
    mongoose.model<IdentityCounter>("IdentityCounter", identityCounterSchema);

/** Atomically reserve the next page number. */
export async function nextPage(): Promise<number> {
    // Seed on first use only. $setOnInsert rather than $inc-with-upsert,
    // because an upserting $inc on a missing field lands on INCREMENT_BY (1),
    // whereas the plugin seeds one increment below START_AT so that the first
    // page issued is 0 — which is what the live data has.
    await IdentityCounterModel.updateOne(
        { model: COUNTER_MODEL, field: COUNTER_FIELD },
        { $setOnInsert: { count: START_AT - INCREMENT_BY } },
        { upsert: true }
    ).exec();

    const counter = await IdentityCounterModel.findOneAndUpdate(
        { model: COUNTER_MODEL, field: COUNTER_FIELD },
        { $inc: { count: INCREMENT_BY } },
        { new: true }
    ).exec();

    return counter?.count ?? START_AT;
}

/** Raise the counter to `page` if it is currently lower. */
export async function raiseCounterTo(page: number): Promise<void> {
    await IdentityCounterModel.findOneAndUpdate(
        { model: COUNTER_MODEL, field: COUNTER_FIELD, count: { $lt: page } },
        { count: page }
    ).exec();
}

/** Read the counter without touching it. */
export async function peekCounter(): Promise<number | null> {
    const counter = await IdentityCounterModel.findOne({
        model: COUNTER_MODEL,
        field: COUNTER_FIELD,
    }).lean();
    return counter?.count ?? null;
}
