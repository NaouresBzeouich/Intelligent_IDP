# Build stage
FROM node:18-alpine AS builder
WORKDIR /app



COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build -- --configuration production --output-path=dist/app

# Final stage
FROM nginx:1.25-alpine


RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/app/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]