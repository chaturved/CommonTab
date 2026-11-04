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
EXPO_PUBLIC_API_URL=https://api.example.com EXPO_PUBLIC_SITE_URL=https://example.com npm run export:web
```

This writes the static site to `dist/`: one HTML file per route, the JavaScript and CSS under `_expo/`, `og.png` and `robots.txt` from `public/`. `scripts/inject-meta.mjs` runs after the export and puts the page titles and link-preview tags (`og:` and Twitter) into the HTML: the landing page gets its own, `/join/*` gets the invite wording, and every app page is `noindex`. `EXPO_PUBLIC_SITE_URL` is used for the absolute `og:url` and `og:image` addresses.

The landing page is rendered into `index.html`, so link previews and search engines see it without running JavaScript.

### Hosting

Any static host works, but it must do two things:

1. Serve `/sign-in` from `sign-in.html` and so on (clean URLs).
2. Rewrite the dynamic routes to their template files, with status 200:

| Request | Serve |
| --- | --- |
| `/join/*` | `/join/[code].html` |
| `/group/*/invite` | `/group/[id]/invite.html` |
| `/group/*/settle` | `/group/[id]/settle.html` |
| `/group/*/members` | `/group/[id]/members.html` |
| `/group/*` | `/group/[id].html` |
| `/expense/*/edit` | `/expense/[id]/edit.html` |
| `/expense/*` | `/expense/[id].html` |

The API must list the site's address in `ALLOWED_ORIGINS` (CORS, in `backend/.env`). The web app has a `gallery` route for design review that is exported too; it holds no data.

Not decided yet: where this is hosted. The old GitHub Pages workflow for the static `website/` folder was removed with that folder.
