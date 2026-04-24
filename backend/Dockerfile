FROM golang:1.26 AS dev-stage

WORKDIR /app

COPY go.mod go.sum ./

ENV GOPRIVATE=github.com/Prypiatos/*
ENV GONOSUMDB=github.com/Prypiatos/*

RUN go mod download

COPY . .
