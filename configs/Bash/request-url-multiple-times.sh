#!/bin/bash

# URL to send requests to
url="https://api.openwebui.com/api/v1/modelfiles/51aa0eec-e37a-4c41-babf-83e7ff43b41c/download"

# Send 5 requests to the URL
for i in {1..2000}
do
   curl $url
done