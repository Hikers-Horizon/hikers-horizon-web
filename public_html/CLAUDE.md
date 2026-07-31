# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hikers Horizon** is a trek booking website for hikes around Bangalore, India. It is a static HTML/CSS frontend with a Node.js + Express + MongoDB backend (`server.js`).

## Running the Project

**Prerequisites**: Node.js and MongoDB must be installed. On Windows, start MongoDB first:
```
net start MongoDB   # Run as Administrator
```

**Install dependencies** (first time only):
```
npm install
```

**Start the server:**
```
npm start
# or
node server.js
```

Access the site at `http://localhost:8080`.

## Architecture

```
Hiker_Proj/
├── server.js          # Express server — all API routes and Mongoose models
├── package.json       # Dependencies: express, mongoose, bcryptjs, body-parser, cors
├── index.html         # Main landing page (served as static file)
├── HH-Project/        # Duplicate of top-level HTML pages (login, signup, index, Blogs)
├── About/             # About page with its own HTML copies
├── Backpacking/       # Trek pages: Wayanad, Coorg, Hampi, Chikmagaluru, Kodaikanal
├── Sunrise/           # Trek pages: Skandagiri, Nandihills, Savandurga, Kuntibetta, etc.
├── Contact/           # Contact page assets
├── Privacy/           # Privacy page assets
└── img/               # Shared images and video backgrounds
```

**Backend (`server.js`)**: Single-file Express app that connects to `mongodb://localhost:27017/hikershorizon`. Defines two Mongoose models inline — `User` and `Booking` — and exposes REST endpoints. Static files are served from the project root (`express.static('.')`).

**Frontend**: Plain HTML pages with inline CSS and Google Fonts (Montserrat, Open Sans). No build step or bundler. Auth state is tracked via `localStorage` (user's email stored after login). No framework — vanilla JS for any interactivity.

## API Routes (all in server.js)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/signup` | Create user (bcrypt-hashed password) |
| POST | `/login` | Authenticate, returns user object |
| GET | `/profile/:email` | Get user + their bookings |
| PUT | `/profile/:email` | Update username |
| GET | `/users` | All users (admin, excludes passwords) |
| DELETE | `/admin/users/:email` | Delete user + bookings (admin password required) |
| GET | `/admin/stats` | Dashboard stats (counts + revenue aggregate) |
| POST | `/book` | Create booking |
| GET | `/bookings/:email` | User's bookings |
| GET | `/all-bookings` | All bookings (admin) |
| POST | `/verify-email/:email` | Mark user as verified |

## Key Notes

- **No auth middleware**: Admin routes check credentials inline by looking up `admin@hikershorizon.com` in the DB. There is no JWT or session system — user identity is passed as plain email in URLs and localStorage.
- **Duplicate directories**: `HH-Project/` and `About/HH-Project/` contain copies of the main HTML pages. The canonical versions are in the project root.
- **MongoDB connection string is hardcoded** in `server.js:16` — no `.env` file is used.
- **Port**: Server runs on `8080`.
