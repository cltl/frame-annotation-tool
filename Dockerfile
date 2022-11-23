FROM node:10

WORKDIR /usr/src/tool
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8787
CMD [ "node", "tool.js" ]