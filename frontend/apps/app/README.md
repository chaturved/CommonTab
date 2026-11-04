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

### Deploying to GitHub Pages

`.github/workflows/web.yml` builds the web app and publishes it when `frontend/` changes on `main` (or when you run it by hand from the Actions tab). It runs the type check and tests first, builds with `EXPO_PUBLIC_API_URL` set from the repository variable `API_URL`, copies `index.html` to `404.html`, and uploads `frontend/apps/app/dist`. One-time setup:

1. **Settings > Pages > Build and deployment > Source:** GitHub Actions.
2. **Settings > Secrets and variables > Actions > Variables:** add `API_URL`, the address of the deployed API (the build stops with a message if it is missing).
3. **Settings > Pages > Custom domain:** `commontab.chaturved-sumanth-lakkaraju.com`, and at your DNS provider a `CNAME` record for `commontab` pointing to `chaturved.github.io`. Turn on "Enforce HTTPS" once the certificate is ready.
4. In `backend/.env` for the API, set `ALLOWED_ORIGINS=https://commontab.chaturved-sumanth-lakkaraju.com`.

Not decided yet: where the API is hosted. The workflow cannot succeed in a useful way until it is, because the build needs `API_URL`.

### SEO and link previews

`public/index.html` carries the title, description, canonical link and the `og:`/Twitter preview tags, with `public/og.png` (1200x630, a screenshot of the landing page) as the image. Every address serves this same file, so every link shows the same card. The site address is written in those tags and in `public/sitemap.xml` and `public/robots.txt` (`https://commontab.chaturved-sumanth-lakkaraju.com`): change all three if the domain changes. The landing page's text is drawn by JavaScript, so it is not in the HTML; a static export would add that (commit `0d23296` has a working one).
