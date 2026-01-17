# Production Dockerfile - clones from GitHub
FROM node:20-alpine AS builder

# Install git and build dependencies for canvas
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# Clone repository
RUN git clone --depth 1 --branch main https://github.com/YuriChirmici/discord-bot.git .

# Install production dependencies only
RUN npm install --omit=dev

# Production stage - only runtime dependencies
FROM node:20-alpine

# Install runtime libraries
RUN apk add --no-cache \
    git \
    cairo \
    pango \
    jpeg \
    giflib \
    pixman \
    fontconfig \
    ttf-dejavu
    

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app .

# Create fonts directory and copy custom fonts
RUN mkdir -p /usr/share/fonts/custom
COPY --from=builder /app/fonts/ /usr/share/fonts/custom/

# Update font cache
RUN fc-cache -f -v

# Create src directory if it doesn't exist
RUN mkdir -p /app/src

ENV NODE_ENV=production

CMD ["npm", "start"]
