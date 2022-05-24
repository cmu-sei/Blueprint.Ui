#!/bin/bash

docker build . -t blueprint/ui --no-cache
docker-compose up -d
