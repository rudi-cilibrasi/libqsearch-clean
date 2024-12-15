#!/bin/bash

set -e

SCRIPTDIR=$(dirname $0)

cd $SCRIPTDIR/..

sudo docker-compose -f docker-compose-dev.yml --profile redis --profile app up --build