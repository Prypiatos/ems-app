package bootstrap

import (
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/shared-models/models"
)

func NewInMemoryDeviceStore() *InMemoryDeviceStore {
	return &InMemoryDeviceStore{db: map[string]models.Node{}}
}

type InMemoryDeviceStore struct {
	db            map[string]models.Node
	healthRecords map[string]models.HealthStatus
	nodes         []models.Node
}

func (i *InMemoryDeviceStore) GetDeviceByID(node_id string) (models.Node, error) {
	if device, ok := i.db[node_id]; ok {
		return device, nil
	}
	return models.Node{}, types.ErrNodeNotFound
}

func (i *InMemoryDeviceStore) GetNodeList() []models.Node {
	return i.nodes
}

func (i *InMemoryDeviceStore) GetDeviceHealth(node_id string) (models.HealthStatus, error) {
	if health, ok := i.healthRecords[node_id]; ok {
		return health, nil
	}
	return models.HealthStatus{}, types.ErrNodeNotFound
}

func NewDeviceStore() *InMemoryDeviceStore {
	// Seed in-memory node metadata for local development.
	db := map[string]models.Node{
		"node_1": {NodeID: "node_1", NodeType: "typeA", Status: types.ONLINE},
		"node_2": {NodeID: "node_2", NodeType: "typeB", Status: types.DEGRADED},
		"node_3": {NodeID: "node_3", NodeType: "typeC", Status: types.OFFLINE_INTENDED},
	}

	// Seed latest health snapshots per node.
	healthRecords := map[string]models.HealthStatus{
		"node_1": {NodeID: "node_1", Status: types.ONLINE, Timestamp: 1713000000, Uptime: 86400, MQTTConnected: true, WifiConnected: true, SensorOK: true, BufferedCount: 0},
		"node_2": {NodeID: "node_2", Status: types.DEGRADED, Timestamp: 1713000100, Uptime: 86410, MQTTConnected: true, WifiConnected: false, SensorOK: true, BufferedCount: 2},
		"node_3": {NodeID: "node_3", Status: types.OFFLINE_INTENDED, Timestamp: 1713000200, Uptime: 86420, MQTTConnected: false, WifiConnected: false, SensorOK: false, BufferedCount: 8},
	}

	nodes := []models.Node{
		{NodeID: "node_1", NodeType: "typeA", Status: types.ONLINE},
		{NodeID: "node_2", NodeType: "typeB", Status: types.DEGRADED},
		{NodeID: "node_3", NodeType: "typeC", Status: types.OFFLINE_INTENDED},
	}

	return &InMemoryDeviceStore{db: db, healthRecords: healthRecords, nodes: nodes}
}
