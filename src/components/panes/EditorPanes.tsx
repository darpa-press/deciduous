import { getPieceByPage, getPersonBySlug, getAllPieces, getAllPersons } from "@/lib/queries";
import { PieceEditor, type Option } from "@/components/editors/PieceEditor";
import { PersonEditor } from "@/components/editors/PersonEditor";
import { NotFoundPane } from "./NotFoundPane";

/**
 * Server side of the editors: load the record and the option lists, then hand
 * them to the client form.
 *
 * Callers must already have checked the session — see PaneBody. The mutations
 * check it again for themselves, because a Server Action is reachable by
 * anyone who knows its id.
 */

/** Accepts either a populated document or a bare id. */
function idOf(value: unknown): string {
    if (value && typeof value === "object" && "_id" in value) {
        return String((value as { _id: unknown })._id);
    }
    return String(value);
}

async function pieceOptions(): Promise<Option[]> {
    const pieces = await getAllPieces({ sort: "title", order: 1 });
    return pieces.map((piece) => ({ value: String(piece._id), label: piece.title ?? "" }));
}

async function personOptions(): Promise<Option[]> {
    const persons = await getAllPersons();
    return persons.map((person) => ({ value: String(person._id), label: person.name ?? "" }));
}

export async function PieceEditPane({ page, index }: { page: number; index: number }) {
    const [piece, pieces, persons] = await Promise.all([
        getPieceByPage(page),
        pieceOptions(),
        personOptions(),
    ]);
    if (!piece) return <NotFoundPane segment={`edit-${page}`} />;

    // `word` is populated, so each entry is a synset document.
    const words = (piece.word ?? []).map((w: unknown) => {
        const word = w as { _id?: string; word?: string; lemma?: string };
        return { id: String(word._id ?? ""), label: word.word ?? word.lemma ?? String(word._id) };
    });

    return (
        <PieceEditor
            index={index}
            id={String(piece._id)}
            page={piece.page ?? null}
            version={piece.__v ?? null}
            // A piece cannot be its own parent or its own lover; offering it
            // was how a piece got filed under itself and dropped out of the
            // index tree. The person editor already did this for relations.
            pieceOptions={pieces.filter((option) => option.value !== String(piece._id))}
            personOptions={persons}
            initial={{
                title: piece.title ?? "",
                content: piece.content ?? "",
                readme: piece.readme ?? "",
                background: piece.background ?? "",
                stub: Boolean(piece.stub),
                fullWidth: Boolean(piece.fullWidth),
                // parent and persons come back populated, so each is a
                // document; lovers are left as plain ids.
                parent: piece.parent ? idOf(piece.parent) : null,
                lovers: (piece.lovers ?? []).map(idOf),
                persons: (piece.persons ?? []).map(idOf),
                word: words,
            }}
        />
    );
}

export async function NewPiecePane({ index }: { index: number }) {
    const [pieces, persons] = await Promise.all([pieceOptions(), personOptions()]);

    return (
        <PieceEditor
            index={index}
            pieceOptions={pieces}
            personOptions={persons}
            initial={{
                title: "",
                content: "",
                readme: "",
                background: "",
                stub: false,
                fullWidth: false,
                parent: null,
                lovers: [],
                persons: [],
                word: [],
            }}
        />
    );
}

export async function PersonEditPane({ slug, index }: { slug: string; index: number }) {
    const [person, persons] = await Promise.all([getPersonBySlug(slug), personOptions()]);
    if (!person) return <NotFoundPane segment={`edit-person-${slug}`} />;

    return (
        <PersonEditor
            index={index}
            id={String(person._id)}
            slug={person.slug ?? null}
            version={person.__v ?? null}
            personOptions={persons.filter((option) => option.value !== String(person._id))}
            initial={{
                name: person.name ?? "",
                bio: person.bio ?? "",
                birth: person.birth != null ? String(person.birth) : "",
                death: person.death != null ? String(person.death) : "",
                wikidata: person.wikidata ?? "",
                relation: (person.relation ?? []).map((entry) => ({
                    relatedPerson: entry.relatedPerson ? String(entry.relatedPerson) : "",
                    relatedReason: entry.relatedReason ?? "",
                })),
            }}
        />
    );
}

export async function NewPersonPane({ index }: { index: number }) {
    const persons = await personOptions();

    return (
        <PersonEditor
            index={index}
            personOptions={persons}
            initial={{ name: "", bio: "", birth: "", death: "", wikidata: "", relation: [] }}
        />
    );
}
