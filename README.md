### Complearn Online Demo 2.0
https://openscienceresearchpark.com/

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
./build_and_launch_docker_system.sh # start all services inside dockers
./deploy.sh # build ncd-calculator and serve at openscienceresearchpark.com
./shawn_staging_build.sh # build ncd-calculator and serve at www.staging.openscienceresearchpark.com
./nam_staging_build.sh # build ncd-calculator and serve at complearn.staging.openscienceresearchpark.com
./teardown.sh # teardown all services
```
