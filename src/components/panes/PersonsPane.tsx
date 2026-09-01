import { getAllPersons } from "@/lib/queries";
import { formatYear } from "@/lib/year";
import { PaneLink } from "@/components/PaneLink";

/**
 * The people listing. The legacy version used react-table 6 with pagination,
 * sorting and resizing all switched off — so it was a plain table behind a
 * table library. It is a plain table here. TanStack Table would be a
 * like-for-like replacement of something that was never needed.
 */
export async function PersonsPane({ index }: { index: number }) {
    const persons = await getAllPersons();

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
                                <PaneLink
                                    target={`p-${person.slug}`}
                                    index={index}
                                    className="person-link"
                                >
                                    {person.name}
                                </PaneLink>
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
