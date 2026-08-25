import { getPersonBySlug } from "@/lib/queries";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A person, followed by every piece they appear in. The bio is stored as HTML
 * and rendered as such, as the legacy component did.
 */
export async function PersonPane({ slug, index }: { slug: string; index: number }) {
    const person = await getPersonBySlug(slug);
    if (!person) return <NotFoundPane segment={`p-${slug}`} />;

    return (
        <div>
            <div className="pane-inside person-inside">
                <div className="person-vitals">
                    <div>{person.name}</div>
                    <div className="person-years">
                        {person.birth || ""}—{person.death || ""}
                    </div>
                </div>
                <div className="person-bio" dangerouslySetInnerHTML={{ __html: person.bio ?? "" }} />
            </div>

            {person.pieces?.length > 0 && (
                <div>
                    {person.pieces.map((piece) => (
                        <PieceBody key={String(piece._id)} piece={piece} index={index} isInList />
                    ))}
                </div>
            )}
        </div>
    );
}
