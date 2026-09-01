import mongoose, { Schema, type Model, type Types } from "mongoose";
import slug from "slugs";
import { uniqueSlug } from "@/lib/unique-slug";

/** People entries in the codex. Ported from backend/models/Person.js. */

export interface PersonDoc {
    _id: Types.ObjectId;
    name: string;
    slug?: string;
    bio?: string;
    birth?: number;
    death?: number;
    /** The Wikidata item these dates were looked up from, e.g. "Q7259". */
    wikidata?: string;
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
    wikidata: { type: String, trim: true },
    created: { type: Date, default: Date.now },
    relation: [
        {
            relatedPerson: { type: Schema.Types.ObjectId, ref: "Person" },
            relatedReason: String,
        },
    ],
});

// `slug` is the routing key and `name` is what the person index sorts on.
personSchema.index({ slug: 1 });
personSchema.index({ name: 1 });

personSchema.pre("save", async function (next) {
    if (!this.isModified("name")) return next();

    this.slug = await uniqueSlug(
        this.constructor as Model<PersonDoc>,
        slug(this.name),
        this._id
    );

    next();
});

export const Person: Model<PersonDoc> =
    (mongoose.models.Person as Model<PersonDoc>) ??
    mongoose.model<PersonDoc>("Person", personSchema);
