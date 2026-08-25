export function NotFoundPane({ segment }: { segment?: string } = {}) {
    return (
        <div className="piece">
            <h1 className="piece-title">
                <div>⋅</div>
            </h1>
            <div className="piece-content">
                <div className="system-font quiet">
                    {segment ? `Nothing at "${segment}".` : "Nothing here."}
                </div>
            </div>
        </div>
    );
}
