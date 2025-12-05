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
# Nginx config for Single Page Application (SPA) routing and API proxy
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:3000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection '\''upgrade'\''; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_cache_bypass $http_upgrade; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]