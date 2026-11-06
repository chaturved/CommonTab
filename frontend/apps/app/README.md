# @commontab/app

Expo app for iOS, Android and web, with the landing page at the web root.

## Run

```sh
npm run web      # dev server for the web build
npm start        # Expo dev server (scan the QR code for a phone)
```

The API address comes from `EXPO_PUBLIC_API_URL` (default `http://localhost:8000`).

## Structure

```
src/
  app/          routes only (Expo Router); screens stay thin
  components/   ui, layout, sync, auth, group, expense, account, landing
  hooks/        one hook per file: useViewport, useLiveQuery, useExpenseForm, useGroupActions, ...
  context/      AppContext (session and services provider)
  services/     createServices and the per-platform storage and token drivers
  lib/          pure helpers (labels, errors, export)
  constants/    config, layout breakpoints, currencies
  types/        shared types
test/           unit tests for lib/ (npm test)
```

Import with the `@/` alias (it maps to `src/`). Anything inside `src/app` becomes a route, so nothing else goes there.

## Routes

- `/` is the landing page on web. On iOS and Android it redirects to `/home` when signed in and `/welcome` when signed out.
- `/home`, `/groups`, `/activity`, `/account` are the signed-in tabs. `/welcome`, `/sign-in`, `/create-account`, `/join-code` are the signed-out screens.
- `/join/CODE` is an invite link: signed in it opens Join with the code filled in; signed out it goes to Create account and joins afterwards.

## Web export

```sh
EXPO_PUBLIC_API_URL=https://api.example.com npm run export:web
```

This writes a static site to `dist/`: one HTML file per route, the JavaScript and CSS under `_expo/`, `og.png`, `robots.txt` and `sitemap.xml`. The landing page's content is in `index.html`, so it shows before any JavaScript loads. App routes (`home.html`, `sign-in.html`, and so on) hold a loading screen; the app starts, reads the saved session from the device, and shows the right screen without waiting for the network.

### Hosting

Any static file host works if it serves `/home` as `home.html` (and so on) and sends every path that has no file (`/join/ABCD-2345`, `/group/...`) to `home.html`:

- Netlify and Cloudflare Pages: a `_redirects` file with `/*  /home.html  200`.
- GitHub Pages: no rewrite rules, so make `404.html` a copy of `home.html`. Pages answers unknown paths with that file (status 404, but the app still loads and shows the right screen). The site must be served from a domain root (a custom domain or `username.github.io`), not a `/CommonTab/` sub-path.

The API must list the site's address in `ALLOWED_ORIGINS` (CORS, in `backend/.env`). The sign-in cookie is `SameSite=Lax`, so the site and the API should share a registrable domain (for example `app.example.com` and `api.example.com`). The web app has a `gallery` route for design review that is exported too; it holds no data.

### Deploying to GitHub Pages

`.github/workflows/web.yml` builds the web app and publishes it when `frontend/` changes on `main` (or when you run it by hand from the Actions tab). It runs the type check and tests first, builds with `EXPO_PUBLIC_API_URL` set from the repository variable `API_URL`, copies `home.html` to `404.html`, and uploads `frontend/apps/app/dist`. One-time setup:

1. **Settings > Pages > Build and deployment > Source:** GitHub Actions.
2. **Settings > Secrets and variables > Actions > Variables:** add `API_URL`, the address of the deployed API. Until it is set, the workflow is skipped (it shows as skipped, not failed), so nothing is built or deployed.
3. **Settings > Pages > Custom domain:** `commontab.chaturved-sumanth-lakkaraju.com`, and at your DNS provider a `CNAME` record for `commontab` pointing to `chaturved.github.io`. Turn on "Enforce HTTPS" once the certificate is ready.
4. In `backend/.env` for the API, set `ALLOWED_ORIGINS=https://commontab.chaturved-sumanth-lakkaraju.com`.

Not decided yet: where the API is hosted. Set `API_URL` only once it is, because the build bakes that address into the site.

### SEO and link previews

`src/app/+html.tsx` carries the title, description, canonical link and the `og:`/Twitter preview tags, with `public/og.png` (1200x630, a screenshot of the landing page) as the image. Every route gets the same tags, so every link shows the same card, and the 404 fallback has the same tags but a 404 status, which some chat apps may ignore. The site address is written in `+html.tsx`, `public/sitemap.xml` and `public/robots.txt` (`https://commontab.chaturved-sumanth-lakkaraju.com`): change all three if the domain changes. The landing page's text is in the HTML, and its phone and desktop layouts are chosen by CSS (`lg:` classes, 1024px), so there is no layout change when the app starts. Text sizes use `!text-[Npx]` because the `Text` variant class would otherwise win at the phone width. Only the mock-up phones beside the headline are sized in JavaScript; they are drawn at full size first and shrink after the app starts on windows narrower than 1280px.
