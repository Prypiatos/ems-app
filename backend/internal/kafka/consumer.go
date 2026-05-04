package kafka

import (
	"context"
)

type Record struct {
	Topic string
	Value []byte
}

type Consumer interface {
	Close() error
	Consume(context context.Context) <-chan Record
}
