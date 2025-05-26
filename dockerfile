# Use Node.js LTS as base image
FROM node:24.0.2-alpine
# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the code
COPY . .

# Run your script
CMD ["node", "whitelistIP.js"]
