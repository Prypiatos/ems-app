FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN npm run build
RUN npm run export

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/out ./out
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["npx", "serve", "-s", "out", "-l", "3000"]
