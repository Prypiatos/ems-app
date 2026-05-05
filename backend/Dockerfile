# FROM golang:1.26 AS builder

# WORKDIR /src

# COPY go.mod go.sum ./

# ENV GOPRIVATE=github.com/Prypiatos/*
# ENV GONOSUMDB=github.com/Prypiatos/*

# RUN go mod download

# COPY . .

# # Build a static, optimized binary for Linux
# ARG VERSION=0.0.0
# RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
# 	go build -ldflags "-s -w -X main.version=${VERSION}" -o /app/backend ./cmd/backend

# FROM alpine:3.18 AS runner

# # Create a non-root user for running the binary
# RUN addgroup -S app && adduser -S app -G app

# # Ensure CA certs are present if the app makes TLS requests
# RUN apk add --no-cache ca-certificates

# WORKDIR /app
# COPY --from=builder /app/backend /app/backend
# RUN touch /app/.env && chown app:app /app/.env
# RUN chown app:app /app/backend

# USER app

# EXPOSE 8080

# LABEL org.opencontainers.image.title="ems-backend" \
# 	  org.opencontainers.image.version="${VERSION}" \
# 	  org.opencontainers.image.description="EMS backend service" \
# 	  org.opencontainers.image.authors=""

# HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["/bin/sh","-c","[ -x /app/backend ] || exit 1"]

# CMD ["/app/backend"]


FROM golang:1.26 AS builder

WORKDIR /src

COPY go.mod go.sum ./

ENV GOPRIVATE=github.com/Prypiatos/*
ENV GONOSUMDB=github.com/Prypiatos/*

RUN go mod download

COPY . .

ARG VERSION=0.0.0

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" \
    -o /app/backend ./cmd/backend


FROM alpine:3.18 AS runner

RUN addgroup -S app && adduser -S app -G app
RUN apk add --no-cache ca-certificates wget

WORKDIR /app

COPY --from=builder /app/backend /app/backend
RUN chown app:app /app/backend

USER app

EXPOSE 8080

LABEL org.opencontainers.image.title="ems-backend" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.description="EMS backend service"

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["/app/backend"]
