//go:build !cgo
// +build !cgo

package main

import "log"

func main() {
	log.Fatal("kafka_producer requires cgo-enabled build")
}
