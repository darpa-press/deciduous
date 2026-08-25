import mongoose, { Schema, type Model, type Types } from "mongoose";
import slug from "slugs";

/** People entries in the codex. Ported from backend/models/Person.js. */

export interface PersonDoc {
    _id: Types.ObjectId;
    name: string;
    slug?: string;
    bio?: string;
    birth?: number;
    death?: number;
    created: Date;
    relation: {
        relatedPerson?: Types.ObjectId;
        relatedReason?: string;
    }[];
}

const personSchema = new Schema<PersonDoc>({
    name: { type: String, trim: true, required: [true, "Please enter a name."] },
    slug: { type: String },
    bio: { type: String, trim: true },
    birth: Number,
    death: Number,
    created: { type: Date, default: Date.now },
    relation: [
        {
            relatedPerson: { type: Schema.Types.ObjectId, ref: "Person" },
            relatedReason: String,
        },
    ],
});

personSchema.pre("save", async function (next) {
    if (!this.isModified("name")) return next();

    this.slug = slug(this.name);

    const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i");
    const personsWithSlug = await (this.constructor as Model<PersonDoc>).find({
        slug: slugRegEx,
    });

    if (personsWithSlug.length) {
        this.slug = `${this.slug}-${personsWithSlug.length + 1}`;
    }

    next();
});

export const Person: Model<PersonDoc> =
    (mongoose.models.Person as Model<PersonDoc>) ??
    mongoose.model<PersonDoc>("Person", personSchema);
