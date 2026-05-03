package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Prypiatos/ems-app/backend/internal/models"
	"github.com/google/uuid"
)

// DivisionRepository handles division queries.
type DivisionRepository struct {
	db *sql.DB
}

// NewDivisionRepository creates a new division repository.
func NewDivisionRepository(db *sql.DB) *DivisionRepository {
	return &DivisionRepository{db: db}
}

// GetHierarchy returns the complete division tree with recursive CTE.
func (r *DivisionRepository) GetHierarchy(ctx context.Context) ([]models.Division, error) {
	// Recursive CTE to fetch all divisions in hierarchy order
	query := `
		WITH RECURSIVE division_hierarchy AS (
			-- Base case: root divisions (no parent)
			SELECT id, name, parent_id, floor, building, created_at
			FROM divisions
			WHERE parent_id IS NULL
			
			UNION ALL
			
			-- Recursive case: children of known divisions
			SELECT d.id, d.name, d.parent_id, d.floor, d.building, d.created_at
			FROM divisions d
			INNER JOIN division_hierarchy dh ON d.parent_id = dh.id
		)
		SELECT id, name, parent_id, floor, building, created_at
		FROM division_hierarchy
		ORDER BY parent_id NULLS FIRST, name
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query hierarchy failed: %w", err)
	}
	defer rows.Close()

	var divisions []models.Division
	divMap := make(map[uuid.UUID]*models.Division)

	// First pass: fetch all rows and build flat map
	for rows.Next() {
		var d models.Division
		if err := rows.Scan(&d.ID, &d.Name, &d.ParentID, &d.Floor, &d.Building, &d.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		d.Children = []models.Division{}
		divMap[d.ID] = &d
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration failed: %w", err)
	}

	// Second pass: build hierarchy
	for _, d := range divMap {
		if d.ParentID == nil {
			// Root division
			divisions = append(divisions, *d)
		} else {
			// Child division - attach to parent
			if parent, ok := divMap[*d.ParentID]; ok {
				parent.Children = append(parent.Children, *d)
			}
		}
	}

	return divisions, nil
}

// GetDivisionByID fetches a single division with its metadata.
func (r *DivisionRepository) GetDivisionByID(ctx context.Context, id uuid.UUID) (*models.Division, error) {
	query := `
		SELECT id, name, parent_id, floor, building, created_at
		FROM divisions
		WHERE id = $1
	`

	var d models.Division
	err := r.db.QueryRowContext(ctx, query, id).
		Scan(&d.ID, &d.Name, &d.ParentID, &d.Floor, &d.Building, &d.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("division not found: %w", err)
	}
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}

	d.Children = []models.Division{}
	return &d, nil
}

// GetActiveDeviceCount returns count of online and degraded devices in a division.
func (r *DivisionRepository) GetActiveDeviceCount(ctx context.Context, divisionID uuid.UUID) (int, int, error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE status = 'online') as online_count,
			COUNT(*) FILTER (WHERE status = 'degraded') as degraded_count
		FROM devices
		WHERE division_id = $1
	`

	var onlineCount, degradedCount int
	err := r.db.QueryRowContext(ctx, query, divisionID).Scan(&onlineCount, &degradedCount)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to count devices: %w", err)
	}

	return onlineCount, degradedCount, nil
}

// GetActiveAlertCount returns count of active alerts for a division.
func (r *DivisionRepository) GetActiveAlertCount(ctx context.Context, divisionID uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM alerts
		WHERE division_id = $1 AND status = 'active'
	`

	var count int
	err := r.db.QueryRowContext(ctx, query, divisionID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count alerts: %w", err)
	}

	return count, nil
}
