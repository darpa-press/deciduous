# DECIDUOUS

Deciduous is a framework for online codices of artwork.  
It consists of a backend utilising express and mongoose, and a frontend utilising React.

## Requirements

-   A mongoDB server for storing the pieces (tested with mLab)
-   AWS S3 bucket for media uploads
-   Vercel account

## Installation

1. Duplicate/rename the `variables.env.example` and fill in the details of your mongoDB server and S3 buckets. Configure a default username/password for management of codex content.
2. (If deploying to [now.sh](http://now.sh), make an additional copy called `variables.env.now`, and set the production variables (including setting `PORT` to `80`).
3. Run `npm run dev` to start the node API server.
4. In the client subdirectory, run `npm run start` to start the React frontend.
5. Visit `localhost:3000/api/user/setup` to create the admin user.
6. Visit `localhost:3000/login` to login.

## Structure

| Directory      | Contents                                     |
| -------------- | -------------------------------------------- |
| `/client`      | React front-end                              |
| `/controllers` | Controllers                                  |
| `/models`      | Models for interacting with mongoose backend |
| `/routes`      | Routes                                       |

## License

Deciduous is MIT licensed. See LICENSE.md for details.
