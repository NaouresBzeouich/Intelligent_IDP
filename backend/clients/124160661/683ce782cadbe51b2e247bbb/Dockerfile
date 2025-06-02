FROM node:20
WORKDIR /app

ENV BACKEND_URL="mongodb+srv://omar:ramo@cluster0.rt44zn0.mongodb.net/"
ENV ENV_VAR_2=""

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]