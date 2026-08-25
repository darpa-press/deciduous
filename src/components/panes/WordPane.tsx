import { getWordById } from "@/lib/queries";
import { PieceBody } from "./PieceBody";
import { NotFoundPane } from "./NotFoundPane";

/**
 * A WordNet synset, and every piece tagged with it. Ported from
 * Pages/Single/Word.
 *
 * It reads as a dictionary line: the lemma in small caps, then the first
 * sense of the gloss, then — if the synset has one — its opposite. The
 * hypernym chain runs underneath as a dimmed breadcrumb, and the count of
 * pieces sits out to the right.
 */

const ucfirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** WordNet glosses pack several senses into one string, separated by ";". */
const firstSense = (gloss: string) => ucfirst(gloss.split(";")[0].trim());

interface WordLike {
    word?: string;
    lemma?: string;
    gloss?: string;
    pos?: string;
}

export async function WordPane({ id, index }: { id: string; index: number }) {
    const result = await getWordById(id);
    if (!result) return <NotFoundPane segment={`w-${id}`} />;

    const { word, pieces, hypernyms, antonyms } = result as unknown as {
        word: WordLike;
        pieces: { _id: unknown; page?: number }[];
        hypernyms: WordLike[];
        antonyms: WordLike[];
    };

    const lemma = word.lemma ?? word.word ?? "";
    const antonym = antonyms?.[0];

    return (
        <div>
            <div className="word-head">
                <div className="word-head-line">
                    <div className="word-gloss">
                        <span>
                            <span className="word-lemma">{ucfirst(lemma)}.</span>{" "}
                            {word.gloss ? `${firstSense(word.gloss)}.` : ""}
                        </span>
                        {antonym?.gloss && (
                            <span>
                                <em>&nbsp;not</em> {firstSense(antonym.gloss)};{" "}
                            </span>
                        )}
                    </div>
                    <div className="word-count">&times; {pieces.length}</div>
                </div>

                {hypernyms?.length > 0 && (
                    <div className="word-hypernyms">
                        {hypernyms.map((hyper, i) => (
                            <div key={`${hyper.lemma ?? hyper.word}-${i}`}>
                                {(hyper.lemma ?? hyper.word ?? "").replace(/_/g, " ")}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {pieces.map((piece) => (
                <PieceBody key={String(piece._id)} piece={piece} index={index} isInList />
            ))}
        </div>
    );
}
