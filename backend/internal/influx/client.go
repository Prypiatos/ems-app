package influx

import (
	"context"
	"fmt"
	"time"
)

// Client interface for InfluxDB queries - abstracts the actual implementation.
type Client interface {
	// GetKWh24h returns total energy consumption in kWh for the last 24 hours.
	// Returns 0 if no data is available (graceful fallback).
	GetKWh24h(ctx context.Context, divisionID string) (float64, error)
	Close() error
}

// MockClient is a placeholder implementation for testing/local dev.
// TODO: Implement real InfluxDB Flux queries when InfluxDB is added to docker-compose.
type MockClient struct{}

// NewMockClient creates a mock InfluxDB client.
func NewMockClient() Client {
	return &MockClient{}
}

// GetKWh24h returns synthetic data for now.
// In production, this will query InfluxDB with Flux aggregation over 24h window.
func (m *MockClient) GetKWh24h(ctx context.Context, divisionID string) (float64, error) {
	// TODO: Query InfluxDB with something like:
	// from(bucket:"energy-readings")
	//   |> range(start: -24h)
	//   |> filter(fn: (r) => r.division_id == "${divisionID}")
	//   |> filter(fn: (r) => r._field == "energy_kwh")
	//   |> sum()

	// For now, return synthetic increasing values based on division ID
	baseValue := 45.5
	return baseValue * 1.0, nil // Placeholder
}

// Close is a no-op for the mock client.
func (m *MockClient) Close() error {
	return nil
}

// RealClient wraps the actual InfluxDB HTTP client (future implementation).
// Stub for now - will be implemented when InfluxDB is properly integrated.
type RealClient struct {
	// client *influxdb2.Client
}

// NewRealClient creates a client for real InfluxDB (future).
func NewRealClient(url, token string) (Client, error) {
	// TODO: Implement with influxdb2 client
	_ = url
	_ = token
	return nil, fmt.Errorf("real InfluxDB client not yet implemented")
}

// QueryResult represents a Flux query result point.
type QueryResult struct {
	Timestamp time.Time
	Value     float64
}
