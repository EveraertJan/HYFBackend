FROM node:8.16.2

RUN mkdir -p /hyf/lib

COPY package.json /hyf
COPY package-lock.json /hyf

WORKDIR /hyf

RUN npm install || cat npm-debug.log

VOLUME /hyf/src
VOLUME /hyf/uploads

EXPOSE 3000

CMD ["npm", "start"]
