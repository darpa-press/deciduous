import { getPersonBySlug } from "@/lib/queries";
import { buildCreateLink } from "@/lib/panes";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A person, followed by every piece they appear in. Ported from
 * Pages/Single/Person. The bio is stored as HTML and rendered as such, exactly
 * as the legacy component did.
 */
export async function PersonPane({
    slug,
    pathArray,
    index,
}: {
    slug: string;
    pathArray: string[];
    index: number;
}) {
    const person = await getPersonBySlug(slug);
    if (!person) return <NotFoundPane segment={`p-${slug}`} />;

    const createLink = buildCreateLink(pathArray, index);

    return (
        <div>
            <div className="border-b border-rule px-8 py-4">
                <div className="mb-4">
                    <div>{person.name}</div>
                    <div className="font-display-italic">
                        {person.birth || ""}—{person.death || ""}
                    </div>
                </div>
                <div
                    className="person-bio italic"
                    dangerouslySetInnerHTML={{ __html: person.bio ?? "" }}
                />
            </div>

            {person.pieces?.length > 0 && (
                <div>
                    {person.pieces.map((piece) => (
                        <PieceBody
                            key={String(piece._id)}
                            piece={piece}
                            createLink={(target) => createLink(target, true)}
                            titleHref={createLink(String(piece.page), false)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
