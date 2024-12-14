#!/bin/bash

set -e

SCRIPTDIR=$(dirname $0)

cd $SCRIPTDIR/..

sudo docker-compose --profile redis --profile app up -d --build