FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4200

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "start"]
