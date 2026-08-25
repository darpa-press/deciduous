import Link from "next/link";

import { getAllPersons } from "@/lib/queries";
import { buildCreateLink } from "@/lib/panes";

/** Years are stored as signed numbers; negatives are BC. */
function formatYear(value?: number) {
    if (!value) return "—";
    return value > 0 ? String(value) : `BC${Math.abs(value)}`;
}

/**
 * The people listing. The legacy version used react-table 6 with pagination,
 * sorting and resizing all switched off — so it was a plain table behind a
 * table library. It is a plain table here. TanStack Table would be a
 * like-for-like replacement of something that was never needed.
 */
export async function PersonsPane({ pathArray, index }: { pathArray: string[]; index: number }) {
    const persons = await getAllPersons();
    const link = buildCreateLink(pathArray, index);

    return (
        <div className="pane-inside">
            <table className="persons-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>b.</th>
                        <th>d.</th>
                    </tr>
                </thead>
                <tbody>
                    {persons.map((person) => (
                        <tr key={String(person._id)}>
                            <td>
                                <Link href={link(`p-${person.slug}`, false)} className="person-link">
                                    {person.name}
                                </Link>
                            </td>
                            <td>{formatYear(person.birth)}</td>
                            <td>{formatYear(person.death)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
