import { getWordById } from "@/lib/queries";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A WordNet synset, followed by every piece tagged with it.
 *
 * The legacy endpoint also walked the hypernym chain and resolved antonyms
 * through node-wordnet on every request — the code path currently crashing in
 * production. Those are admin-facing enrichments; this pane reads what is
 * stored, and the WordNet integration returns in Phase 5 behind a single
 * shared instance.
 */
export async function WordPane({ id, index }: { id: string; index: number }) {
    const result = await getWordById(id);
    if (!result) return <NotFoundPane segment={`w-${id}`} />;

    const { word, pieces } = result;

    return (
        <div>
            <div className="pane-inside person-vitals">
                <div className="font-display-italic text-lg">{word.word ?? word.lemma}</div>
                {word.pos && <div className="system-font quiet">{word.pos}</div>}
                {word.gloss && <div className="mt-2 italic">{word.gloss}</div>}
            </div>

            {pieces.length > 0 && (
                <div>
                    {pieces.map((piece) => (
                        <PieceBody key={String(piece._id)} piece={piece} index={index} isInList />
                    ))}
                </div>
            )}
        </div>
    );
}
