import { getWordById } from "@/lib/queries";
import { buildCreateLink } from "@/lib/panes";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A WordNet synset, followed by every piece tagged with it.
 *
 * The legacy endpoint also walked the hypernym chain and resolved antonyms
 * through node-wordnet on every request — which is the code path that is
 * currently crashing in production. Those are admin-facing enrichments; this
 * pane reads what is stored, and the WordNet integration returns in Phase 5
 * behind a single shared instance.
 */
export async function WordPane({
    id,
    pathArray,
    index,
}: {
    id: string;
    pathArray: string[];
    index: number;
}) {
    const result = await getWordById(id);
    if (!result) return <NotFoundPane segment={`w-${id}`} />;

    const { word, pieces } = result;
    const createLink = buildCreateLink(pathArray, index);

    return (
        <div>
            <div className="border-b border-rule px-8 py-4">
                <div className="font-display-italic text-lg">{word.word ?? word.lemma}</div>
                {word.pos && <div className="system-font quiet">{word.pos}</div>}
                {word.gloss && <div className="mt-2 italic">{word.gloss}</div>}
            </div>

            {pieces.length > 0 && (
                <div>
                    {pieces.map((piece) => (
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
