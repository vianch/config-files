#!/bin/bash

cd ~/huts-page

# pull from  develop branch
git pull origin develop

# followed by docker create image and deploy
docker-compose -f docker-compose-develop.yml build
docker-compose -f docker-compose-develop.yml down
docker-compose -f docker-compose-develop.yml up -d

echo "Deploy build on dev completed"