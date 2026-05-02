package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/influx"
	"github.com/Prypiatos/ems-app/backend/internal/models"
	"github.com/Prypiatos/ems-app/backend/internal/repository"
	"github.com/google/uuid"
)

// DivisionService provides division queries with caching.
type DivisionService struct {
	repo           *repository.DivisionRepository
	influxClient   influx.Client
	cacheMu        sync.RWMutex
	hierarchyCache []models.Division
	cacheExpiry    time.Time
	cacheTTL       time.Duration
}

// NewDivisionService creates a new division service.
func NewDivisionService(repo *repository.DivisionRepository, influxClient influx.Client) *DivisionService {
	return &DivisionService{
		repo:         repo,
		influxClient: influxClient,
		cacheTTL:     5 * time.Minute, // Refresh cache every 5 minutes
	}
}

// GetHierarchy returns the cached division hierarchy, refreshing if needed.
func (s *DivisionService) GetHierarchy(ctx context.Context) ([]models.Division, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("division repository not initialized")
	}

	s.cacheMu.RLock()
	if time.Now().Before(s.cacheExpiry) && len(s.hierarchyCache) > 0 {
		defer s.cacheMu.RUnlock()
		return s.hierarchyCache, nil
	}
	s.cacheMu.RUnlock()

	// Cache miss or expired - fetch from database
	divisions, err := s.repo.GetHierarchy(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch hierarchy: %w", err)
	}

	// Update cache
	s.cacheMu.Lock()
	s.hierarchyCache = divisions
	s.cacheExpiry = time.Now().Add(s.cacheTTL)
	s.cacheMu.Unlock()

	return divisions, nil
}

// GetDivisionSummary fetches a division and combines it with realtime metrics.
func (s *DivisionService) GetDivisionSummary(ctx context.Context, divisionID uuid.UUID) (*models.DivisionSummary, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("division repository not initialized")
	}
	// Fetch division metadata in parallel with metrics
	divChan := make(chan *models.Division, 1)
	divErrChan := make(chan error, 1)

	go func() {
		div, err := s.repo.GetDivisionByID(ctx, divisionID)
		if err != nil {
			divErrChan <- err
		} else {
			divChan <- div
		}
	}()

	// Fetch device counts
	activeDevices, degradedDevices, err := s.repo.GetActiveDeviceCount(ctx, divisionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get device count: %w", err)
	}

	// Fetch alert counts
	activeAlerts, err := s.repo.GetActiveAlertCount(ctx, divisionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert count: %w", err)
	}

	// Fetch energy consumption from InfluxDB
	divisionIDStr := divisionID.String()
	kwh24h, err := s.influxClient.GetKWh24h(ctx, divisionIDStr)
	if err != nil {
		// Log but don't fail - use 0 as fallback
		fmt.Printf("Warning: failed to fetch kWh for division %s: %v\n", divisionIDStr, err)
		kwh24h = 0
	}

	// Wait for division metadata
	var div *models.Division
	select {
	case div = <-divChan:
	case err := <-divErrChan:
		return nil, fmt.Errorf("failed to fetch division: %w", err)
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Combine everything into summary
	summary := &models.DivisionSummary{
		ID:              div.ID,
		Name:            div.Name,
		Floor:           div.Floor,
		Building:        div.Building,
		TotalKWh24h:     kwh24h,
		ActiveDevices:   activeDevices,
		DegradedDevices: degradedDevices,
		ActiveAlerts:    activeAlerts,
	}

	return summary, nil
}
