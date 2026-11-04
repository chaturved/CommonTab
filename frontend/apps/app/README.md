# @commontab/app

Expo app for iOS, Android and web, with the landing page at the web root.

## Run

```sh
npm run web      # dev server for the web build
npm start        # Expo dev server (scan the QR code for a phone)
```

The API address comes from `EXPO_PUBLIC_API_URL` (default `http://localhost:8000`).

## Routes

- `/` is the landing page on web. On iOS and Android it redirects to `/home` when signed in and `/welcome` when signed out.
- `/home`, `/groups`, `/activity`, `/account` are the signed-in tabs. `/welcome`, `/sign-in`, `/create-account`, `/join-code` are the signed-out screens.
- `/join/CODE` is an invite link: signed in it opens Join with the code filled in; signed out it goes to Create account and joins afterwards.

## Web export

```sh
EXPO_PUBLIC_API_URL=https://api.example.com npm run export:web
```

This writes a single-page app to `dist/`: one `index.html`, the JavaScript and CSS under `_expo/`, and `robots.txt`. The browser loads `index.html` for every address, and the app reads the address to decide what to show, so the page is blank until the JavaScript has loaded.

### Hosting

Any static file host works if it sends every path that is not a file (`/sign-in`, `/home`, `/join/ABCD-2345`, `/group/...`) to `index.html`:

- Netlify and Cloudflare Pages: a `_redirects` file with `/*  /index.html  200`.
- GitHub Pages: no rewrite rules, so make `404.html` a copy of `index.html`. Pages answers unknown paths with that file (status 404, but the app still loads and shows the right screen). The site must be served from a domain root (a custom domain or `username.github.io`), not a `/CommonTab/` sub-path.

The API must list the site's address in `ALLOWED_ORIGINS` (CORS, in `backend/.env`). The sign-in cookie is `SameSite=Lax`, so the site and the API should share a registrable domain (for example `app.example.com` and `api.example.com`). The web app has a `gallery` route for design review that is exported too; it holds no data.

Not decided yet: where this is hosted. The old GitHub Pages workflow for the static `website/` folder was removed with that folder.

Link previews (the card a chat app shows for a pasted link) are not set up: the single-page build has no page text or preview tags in its HTML. A static export would add them; see PROGRESS.md.
