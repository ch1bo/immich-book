# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install serve package globally for static file serving
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port 3000
EXPOSE 3000

# Serve the application on port 3000
CMD ["serve", "-s", "dist", "-l", "3000"]

