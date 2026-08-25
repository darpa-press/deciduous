/**
 * Phase 1 placeholder. The real route is the pane stack at
 * app/[[...panes]]/page.tsx, which lands in Phase 3 and replaces this file —
 * at which point `/` redirects to `/2/125` as it does today.
 *
 * Until then this doubles as a font specimen, so a wrong @font-face path is
 * visible immediately rather than at the end of the migration.
 */

const specimens = [
    { family: "Louize", label: "Louize — body", className: "font-body" },
    { family: "Louize italic", label: "Louize — italic", className: "font-body italic" },
    { family: "Figgins", label: "Figgins — display", className: "font-display" },
    { family: "FigginsItalic", label: "FigginsItalic — separate family", className: "font-display-italic" },
    { family: "P22 Cezanne", label: "P22 Cezanne — titling", className: "font-titling" },
];

export default function Page() {
    return (
        <main className="h-full overflow-y-auto">
            <div className="mx-auto max-w-2xl px-8 py-16">
                <h1 className="font-titling text-3xl">Deciduous</h1>
                <p className="quiet system-font mt-2">
                    Phase 1 scaffold — Next 16, Tailwind 4, legacy type scale and webfonts.
                </p>

                <div className="mt-10 flex flex-col gap-6">
                    {specimens.map((s) => (
                        <div key={s.family} className="border-t border-rule pt-3">
                            <div className="system-font quiet">{s.label}</div>
                            <div className={`${s.className} mt-1 text-2xl`}>
                                Deciduous is a framework for online codices of artwork.
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
