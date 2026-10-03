# CommonTab website and web app

The landing page at `index.html` introduces CommonTab. The browser app lives in `app/`, with `app.html` and `demo.html` redirecting there for older links. The app includes the tip calculator and a personal expense list. Three example expenses appear on first visit. Edits are saved in the visitor's browser with `localStorage`.

`site.css` styles the product pages; `app/styles.css` belongs to the interactive app. Shared images live in `assets/`. Add future product pages as their own directories under `apps/web` (for example, `features/index.html`) and keep app behavior under `app/`. Relative links keep the same layout working on localhost and GitHub Pages project URLs.

The web app uses US dollars and does not include local groups, shared groups, receipt scanning, account sign-in, or the FastAPI backend. No expense information is uploaded by this page.

On iPhone, visitors can use Safari's **Share → Add to Home Screen** action to keep the web app as an icon. It needs an internet connection to load.

## Preview locally

From the repository root:

```sh
python3 -m http.server 3000 --directory apps/web
```

Open `http://localhost:3000` for the product site, or `http://localhost:3000/app/` for the web app. The JavaScript files are ES modules, so serve the directory over HTTP rather than opening the files directly.

Run the calculator tests with:

```sh
node --test apps/web/app/money.test.mjs
```

## Publish on GitHub Pages

The workflow in `.github/workflows/website.yml` tests and publishes `apps/web` when it reaches `main`. In the GitHub repository, select **Settings → Pages → Build and deployment → GitHub Actions** as the source. After the workflow completes, the website URL will be shown on the Pages settings screen and in the deployment job.
