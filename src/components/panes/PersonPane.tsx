import { getPersonBySlug } from "@/lib/queries";
import { renderContent } from "@/lib/content/render";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A person, followed by every piece they appear in. The bio is stored as HTML
 * and rendered as such, as the legacy component did — through the content
 * pipeline, so it goes past the same sanitiser everything else does.
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
                {/* Through the same allowlist as piece content. The bio was
                    the one stored-HTML field written straight to the DOM, and
                    nothing sanitised it on the way in either — a sink waiting
                    for one imported record, and at odds with the model the
                    content schema documents for itself. */}
                {person.bio && (
                    <div className={`person-bio person-scope-${slug}`}>
                        {renderContent(person.bio, index, `person-scope-${slug}`)}
                    </div>
                )}
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
