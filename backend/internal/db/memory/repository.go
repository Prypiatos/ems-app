package memory

import (
	"context"
	"sync"

	"github.com/Prypiatos/ems-app/backend/internal/db"
)

type Repository struct {
	mu   sync.RWMutex
	data map[string]map[string]any
}

var _ db.Repository = (*Repository)(nil)

func NewRepository() *Repository {
	return &Repository{
		data: make(map[string]map[string]any),
	}
}

func (r *Repository) Create(_ context.Context, collection, id string, value any) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	records, ok := r.data[collection]
	if !ok {
		records = make(map[string]any)
		r.data[collection] = records
	}

	records[id] = value
	return nil
}

func (r *Repository) Get(_ context.Context, collection, id string) (any, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	records, ok := r.data[collection]
	if !ok {
		return nil, db.ErrRecordNotFound
	}

	value, ok := records[id]
	if !ok {
		return nil, db.ErrRecordNotFound
	}

	return value, nil
}

func (r *Repository) List(_ context.Context, collection string) ([]any, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	records, ok := r.data[collection]
	if !ok {
		return []any{}, nil
	}

	values := make([]any, 0, len(records))
	for _, value := range records {
		values = append(values, value)
	}

	return values, nil
}

func (r *Repository) Update(_ context.Context, collection, id string, value any) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	records, ok := r.data[collection]
	if !ok {
		return db.ErrRecordNotFound
	}
	if _, exists := records[id]; !exists {
		return db.ErrRecordNotFound
	}

	records[id] = value
	return nil
}

func (r *Repository) Delete(_ context.Context, collection, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	records, ok := r.data[collection]
	if !ok {
		return db.ErrRecordNotFound
	}
	if _, exists := records[id]; !exists {
		return db.ErrRecordNotFound
	}

	delete(records, id)
	return nil
}
