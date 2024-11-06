### Development environment
##### Config the API key for using NCBI APIs
1. Go to: https://account.ncbi.nlm.nih.gov/settings/ > *Account Settings*
2. In the *API Key Management* section at the bottom, take the API key
##### Run the `ncd-calculator`:
```
cd ncd-calculator
```
1. Create the `.env.development` file in the source root folder 
2. Create a variable to hold the API key:
```
VITE_NCBI_API_KEY=<XXX-API-KEY-FROM-NCBI>
```
```bash
npm install && npm run dev
```