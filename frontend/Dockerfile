# Stage 1: Build React App
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install dependencies
RUN npm install
COPY . .
# Run the build script
RUN npm run build 

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy the built files (usually to 'build' folder)
COPY --from=builder /app/build /usr/share/nginx/html 
# Nginx config for Single Page Application (SPA) routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]