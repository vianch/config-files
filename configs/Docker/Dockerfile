FROM node:fermium-alpine3.13

ENV API_HOST http://localhost
ENV API_PORT 8080

# Create app directory
RUN mkdir -p /project-folder
WORKDIR /project-folder

# Installing dependencies
COPY package.json /project-folder/
RUN yarn install

# Copying source files
COPY . /project-folder

# Building app
RUN yarn run build
EXPOSE 8080

# Running the app
CMD ["yarn", "start"]
