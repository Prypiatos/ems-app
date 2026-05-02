package models

import (
	"time"

	"github.com/google/uuid"
)

// Division represents a division in the hierarchy (building, floor, department, etc).
type Division struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"`
	Floor     *string    `json:"floor,omitempty"`
	Building  *string    `json:"building,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	Children  []Division `json:"children,omitempty"`
}

// DivisionSummary combines metadata with realtime metrics.
type DivisionSummary struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Floor           *string   `json:"floor,omitempty"`
	Building        *string   `json:"building,omitempty"`
	TotalKWh24h     float64   `json:"total_kwh_24h"`
	ActiveDevices   int       `json:"active_devices"`
	ActiveAlerts    int       `json:"active_alerts"`
	DegradedDevices int       `json:"degraded_devices"`
}
