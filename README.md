![Screenshot of Deciduous](https://i.imgur.com/2NeRbn1.jpg)

Deciduous is a framework for online codices of artwork.
It is a Next.js App Router application, storing pieces in MongoDB.

## Requirements

-   A MongoDB server for storing the pieces (Atlas in production)
-   A Vercel Blob store for media uploads
-   Vercel account

## Installation

1. Copy `.env.example` to `.env.local` and fill it in — it documents each
   variable and the command that produces it.
2. Run `npm install`.
3. Run `npm run dev` and visit `localhost:3000`.
4. Visit `localhost:3000/login` to log in as the single admin, using the
   password you hashed into `ADMIN_PASSWORD_HASH`.

## Testing

`npm test` runs everywhere. The unit suites need nothing; the database and site
suites skip themselves — loudly — when there is nothing to talk to.

To run the database and editor suites, which cover the writes:

```
npm run db:up      # start a local MongoDB in Docker, seeding dump/ if empty
npm run test:data
npm run db:down    # stop it; the data is kept
```

`npm run db:status` says what is running and what is in it, and `npm run
db:reset` drops the database and restores `dump/` over it. `db:up` is safe to
run repeatedly — it creates the container, starts a stopped one, or does
nothing, as needed.

The site suite additionally wants the app itself:

```
npm run build && PORT=3100 npm start
npm run test:site
```

The suite looks at `localhost:3100` unless `BASE_URL` says otherwise, which is
also how it is pointed at a deployment.

## Structure

| Directory         | Contents                                        |
| ----------------- | ----------------------------------------------- |
| `/src/app`        | Routes, pages, and route handlers                |
| `/src/components` | React components                                 |
| `/src/lib`        | Queries, auth, and content rendering             |
| `/src/models`     | Mongoose models                                  |
| `/scripts`        | Local data, verification, and maintenance tasks  |
| `/tests`          | Unit, database, and HTTP suites                   |
| `/baseline`       | Captured responses from the 2020 app, for diffing |

## License

Deciduous is MIT licensed. See LICENSE.md for details.
