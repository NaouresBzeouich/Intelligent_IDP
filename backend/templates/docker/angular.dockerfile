# ===== Builder Stage =====
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the Angular application
# If it's a single project workspace, Angular CLI often infers the project.
RUN npm run build -- --configuration production  --output-path=dist/app

# ===== Final Stage (e.g., Nginx) =====
FROM nginx:1.25-alpine
RUN rm -rf /usr/share/nginx/html/*  

# Copy the built artifacts from the standardized location
COPY --from=builder /app/dist/app/browser /usr/share/nginx/html

# Copy Nginx configuration if you have a custom one
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]