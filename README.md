### Development environment
##### Config the API key for using NCBI APIs
1. Go to: https://account.ncbi.nlm.nih.gov/settings/ > *Account Settings*
2. In the *API Key Management* section at the bottom, take the API key
##### Run the `ncd-calculator`:
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

##### Run the `complearn-genbank`:
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
    ├── app.js   
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
4. Running commands
```bash
npm install
node ./bin/www
```
5. Docker commands
```bash
docker build -t complearn-genbank .
docker run -p 3001:3001 --env-file .env complearn-genbank
```