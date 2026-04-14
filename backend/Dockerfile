FROM golang:1.26 AS build-stage

WORKDIR /app

COPY go.mod go.sum ./

ENV GOPRIVATE=github.com/Prypiatos/*
ENV GONOSUMDB=github.com/Prypiatos/*

RUN go mod download

COPY . .

ENV CGO_ENABLED=1
RUN go build -o /backend-app ./cmd/backend

FROM build-stage AS run-test-stage
RUN go test -v ./...

FROM debian:bookworm-slim AS build-release-stage

WORKDIR /

COPY --from=build-stage /backend-app /backend-app

RUN useradd -m appuser
USER appuser

ENTRYPOINT [ "/backend-app" ]
