package db

import (
	"context"
	"errors"
)

var ErrRecordNotFound = errors.New("record not found")

// Repository defines minimal CRUD-shaped operations for future persistence work.
type Repository interface {
	Create(ctx context.Context, collection, id string, value any) error
	Get(ctx context.Context, collection, id string) (any, error)
	List(ctx context.Context, collection string) ([]any, error)
	Update(ctx context.Context, collection, id string, value any) error
	Delete(ctx context.Context, collection, id string) error
}
