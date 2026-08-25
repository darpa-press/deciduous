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

## Structure

| Directory         | Contents                                        |
| ----------------- | ----------------------------------------------- |
| `/src/app`        | Routes, pages, and route handlers                |
| `/src/components` | React components                                 |
| `/src/lib`        | Queries, auth, and content rendering             |
| `/src/models`     | Mongoose models                                  |
| `/scripts`        | Local data, verification, and maintenance tasks  |
| `/baseline`       | Captured responses from the 2020 app, for diffing |

## License

Deciduous is MIT licensed. See LICENSE.md for details.
