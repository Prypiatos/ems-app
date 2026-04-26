//go:build !cgo
// +build !cgo

package kafka

import "errors"

func NewConsumer(topic, groupID string) (Consumer, error) {
	return nil, errors.New("kafka consumer requires cgo-enabled build")
}
