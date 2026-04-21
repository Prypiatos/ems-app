FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
# Install ALL dependencies (including dev)
RUN if [ -f pnpm-lock.yaml ]; then pnpm install; \
    else npm install; \
    fi

FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Install only production dependencies
RUN npm install --omit=dev
EXPOSE 3000
CMD ["npm", "run", "start"]
