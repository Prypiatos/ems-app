package kafka

import (
	"context"
)

type Consumer interface {
	Close() error
	Consume(context context.Context) <-chan []byte
}
