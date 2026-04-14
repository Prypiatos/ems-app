package main

import (
	"github.com/Prypiatos/ems-app/backend/internal/models"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
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
	return models.Node{}, routes.ErrNodeNotFound
}

func (i *InMemoryDeviceStore) GetNodeList() []models.Node {
	return i.nodes
}

func (i *InMemoryDeviceStore) GetDeviceHealth(node_id string) (models.HealthStatus, error) {
	if health, ok := i.healthRecords[node_id]; ok {
		return health, nil
	}
	return models.HealthStatus{}, routes.ErrNodeNotFound
}
