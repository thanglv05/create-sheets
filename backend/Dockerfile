FROM node:20-alpine
WORKDIR /app

# Copy root dependency files
COPY package*.json ./
RUN npm ci --only=production

# Copy backend files
COPY backend/ ./backend/

# Copy Google auth files if they exist in build context
COPY credentials.json* token.json* ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "backend/server.js"]
