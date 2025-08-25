FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose port for HTTP transport (if needed)
EXPOSE 3000

# Start the MCP server
CMD ["node", "dist/index.js"]
