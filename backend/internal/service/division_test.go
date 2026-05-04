package service

import (
	"context"
	"testing"

	"github.com/Prypiatos/ems-app/backend/internal/influx"
)

func TestDivisionServiceCachingWithNilRepo(t *testing.T) {
	mockInflux := influx.NewMockClient()
	divService := NewDivisionService(nil, mockInflux)

	if _, err := divService.GetHierarchy(context.Background()); err == nil {
		t.Fatalf("expected error with nil repo, got nil")
	}

	if _, err := divService.GetHierarchy(context.Background()); err == nil {
		t.Fatalf("expected error with nil repo on second call, got nil")
	}
}
