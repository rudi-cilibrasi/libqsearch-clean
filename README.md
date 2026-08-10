### Complearn Online Demo 2.0
https://openscienceresearchpark.com/

### Communities

https://x.com/cilibrar/status/1868028637821481347

### Research

Based on the paper [Clustering by Compression](https://homepages.cwi.nl/~paulv/papers/cluster.pdf) by Cilibrasi and Vitányi

The calculator includes a locally bundled, integrity-checked GRS 1915+105 RXTE time-series example based on the astronomy experiment in Section VIII-F. It uses a reproducible CC BY 4.0 public analogue because the paper's exact 16 privately supplied intervals are not publicly identified. The data contract and scientific limitations are in [`ncd-calculator/docs/ASTRONOMY_EXAMPLE.md`](ncd-calculator/docs/ASTRONOMY_EXAMPLE.md).

Completed clustering experiments can be downloaded as versioned JSON containing the exact inputs, compression records, NCD matrices, quartet topology, search metadata, and integrity hashes. See [`ncd-calculator/docs/CLUSTERING_EXPERIMENT_EXPORT.md`](ncd-calculator/docs/CLUSTERING_EXPERIMENT_EXPORT.md).

### Development environment
##### Configure NCBI E-utilities
1. Go to: https://account.ncbi.nlm.nih.gov/settings/ > *Account Settings*
2. In the *API Key Management* section at the bottom, take the API key
##### Add environment variables for `ncd-calculator`:
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
VITE_BACKEND_BASE_URL=<BACKEND-SERVER-DOMAIN> (i.e. https://openscienceresearchpark.com/api)
VITE_GA_MEASUREMENT_ID=<GA4-WEB-STREAM-ID> (optional, i.e. G-XXXXXXXXXX)
```

The GA4 measurement ID is a public build-time identifier, not a secret. When it is unset, analytics is disabled. The frontend reports only coarse calculation start/completion events in addition to GA4's default web measurement; it does not send scientific inputs. See [`ncd-calculator/docs/GOOGLE_ANALYTICS.md`](ncd-calculator/docs/GOOGLE_ANALYTICS.md) for counting semantics, dashboard setup, privacy controls, and deployment requirements.
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

GENBANK_API_KEY=<NCBI_API_KEY>
NCBI_EMAIL=<MAINTAINER_EMAIL>

FRONTEND_BASE_URL=<FRONTEND_BASE_URL> (i.e. https://openscienceresearchpark.com)
BASE_URL=<BACKEND_BASE_URL> (i.e. https://openscienceresearchpark.com/api)
PORT=3001
```

The API key is kept on the backend and must not be exposed through a `VITE_` variable. NCBI permits one API key per account. Without a key, the backend automatically uses the documented three-request-per-second limit; with a key it uses ten requests per second. `NCBI_EMAIL` identifies the maintainer to NCBI for operational contact.

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
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX \
npm run build
```
