package memory

import (
	"context"
	"errors"
	"testing"

	"github.com/Prypiatos/ems-app/backend/internal/db"
)

func TestRepositoryCRUD(t *testing.T) {
	repo := NewRepository()
	ctx := context.Background()

	if err := repo.Create(ctx, "devices", "dev-1", map[string]string{"name": "meter-1"}); err != nil {
		t.Fatalf("create returned error: %v", err)
	}

	got, err := repo.Get(ctx, "devices", "dev-1")
	if err != nil {
		t.Fatalf("get returned error: %v", err)
	}

	device, ok := got.(map[string]string)
	if !ok {
		t.Fatalf("unexpected type: %T", got)
	}
	if device["name"] != "meter-1" {
		t.Fatalf("unexpected value: %v", device)
	}

	if err := repo.Update(ctx, "devices", "dev-1", map[string]string{"name": "meter-2"}); err != nil {
		t.Fatalf("update returned error: %v", err)
	}

	if _, err := repo.List(ctx, "devices"); err != nil {
		t.Fatalf("list returned error: %v", err)
	}

	if err := repo.Delete(ctx, "devices", "dev-1"); err != nil {
		t.Fatalf("delete returned error: %v", err)
	}

	_, err = repo.Get(ctx, "devices", "dev-1")
	if !errors.Is(err, db.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got: %v", err)
	}
}
