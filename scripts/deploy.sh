#!/bin/bash

set -e

SCRIPTDIR=$(dirname $0)

cd $SCRIPTDIR/../ncd-calculator
npm install
npm run build

sudo cp -r dist/* /home/nginx/hosts/openscienceresearchpark.com

echo "Finished serving openscienceresearchpark.com"