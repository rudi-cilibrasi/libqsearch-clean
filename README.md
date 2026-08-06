### Complearn Online Demo 2.0
https://openscienceresearchpark.com/

### Communities

https://x.com/cilibrar/status/1868028637821481347

### Research

Based on the paper [Clustering by Compression](https://homepages.cwi.nl/~paulv/papers/cluster.pdf) by Cilibrasi and Vitányi

### Development environment
##### Config the API key for using NCBI APIs
1. Go to: https://account.ncbi.nlm.nih.gov/settings/ > *Account Settings*
2. In the *API Key Management* section at the bottom, take the API key
##### Add ENV variables for `ncd-calculator`:
```
cd ncd-calculator
```
1. Create the `.env` file in the source root folder
```
    ncd-calculator
    ├── .env
    ├── api
    ├── src             
    ├── ......
```
2. Create environment variables in .env file:
```
VITE_NCBI_API_KEY=<XXX-API-KEY-FROM-NCBI>
VITE_BACKEND_BASE_URL=<BACKEND-SERVER-DOMAIN> (i.e. https://openscienceresearchpark.com/api)
```
3. Running commands
```bash
npm install && npm run dev
```

##### Add ENV variables for `complearn-genbank`:
```
cd complearn-genbank
```
1. Setting up google & github authentication

Register an oauth app for github: https://github.com/settings/applications/new  
Register an oauth app for google: https://console.cloud.google.com/apis/credentials

2. Create the `.env` file in the source root folder
```
    complearn-genbank
    ├── .env
    ├── bin
    ├── routes            
    ├── app.ts   
    ├── ......
```
3. Create environment variables in .env file:
```
GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
GITHUB_CLIENT_ID=<GITHUB_CLIENT_ID>
GITHUB_CLIENT_SECRET=<GITHUB_CLIENT_SECRET>

GENBANK_API_KEY_1=<GENBANK_SHARED_API_KEY_1>
GENBANK_API_KEY_2=<GENBANK_SHARED_API_KEY_2>
GENBANK_API_KEY_3=<GENBANK_SHARED_API_KEY_3>

FRONTEND_BASE_URL=<FRONTEND_BASE_URL> (i.e. https://openscienceresearchpark.com)
BASE_URL=<BACKEND_BASE_URL> (i.e. https://openscienceresearchpark.com/api)
PORT=3001
```

##### Start up all services:
Each sub-project has their own respective Dockerfile. All running by the `docker-compose.yml` in the root folder. Run this to start all services:
```
cd scripts
./prod_compose_build_up.sh # docker-compose build and up all services (except ncd-calculator)
./deploy.sh # build ncd-calculator and serve at openscienceresearchpark.com
./shawn_staging_build.sh # build ncd-calculator and serve at www.staging.openscienceresearchpark.com
./nam_staging_build.sh # build ncd-calculator and serve at complearn.staging.openscienceresearchpark.com
./teardown.sh # teardown all services
```

### GitHub Pages deployment under `/ncd/`

The React frontend supports a configurable public base path. Build it for a GitHub Pages subdirectory with:

```bash
cd ncd-calculator
VITE_BASE_URL=/ncd/ \
VITE_BACKEND_BASE_URL=https://openscienceresearchpark.com/api \
VITE_AUTH_ENABLED=false \
npm run build
```

Publish the contents of `ncd-calculator/dist/` at `/ncd/`. GitHub Pages is static hosting, so direct browser visits to `/ncd/calculator`, `/ncd/about`, and `/ncd/error` also need an `index.html` fallback at each route. The portfolio repository at `namvdo.github.io` automates this with `npm run update-ncd`.

The compression, QSearch, and K-Grid pipelines run in the browser. Authentication, Redis caching, and the request proxy require the separately hosted `complearn-genbank` API, whose CORS and OAuth settings must allow the GitHub Pages or custom-domain origin. Keep `VITE_AUTH_ENABLED=false` for a static-only deployment; set it to `true` only after that API configuration is in place.

As of 2026-08-06, the frontend's historical `npm run typecheck` command reports pre-existing strict-type errors, including errors in generated WebAssembly bindings. Until that backlog is resolved, the portfolio deployment script gates this integration on the base-path and landing-page tests plus a successful Vite production build.
