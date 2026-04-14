package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/Prypiatos/ems-app/backend/internal/models"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
)

func main() {

	// Seed in-memory node metadata for local development.
	db := map[string]models.Node{
		"node_1": {NodeID: "node_1", NodeType: "typeA", Status: routes.ONLINE},
		"node_2": {NodeID: "node_2", NodeType: "typeB", Status: routes.DEGRADED},
		"node_3": {NodeID: "node_3", NodeType: "typeC", Status: routes.OFFLINE_INTENDED},
	}

	// Seed latest health snapshots per node.
	healthRecords := map[string]models.HealthStatus{
		"node_1": {NodeID: "node_1", Status: routes.ONLINE, Timestamp: 1713000000, Uptime: 86400, MQTTConnected: true, WifiConnected: true, SensorOK: true, BufferedCount: 0},
		"node_2": {NodeID: "node_2", Status: routes.DEGRADED, Timestamp: 1713000100, Uptime: 86410, MQTTConnected: true, WifiConnected: false, SensorOK: true, BufferedCount: 2},
		"node_3": {NodeID: "node_3", Status: routes.OFFLINE_INTENDED, Timestamp: 1713000200, Uptime: 86420, MQTTConnected: false, WifiConnected: false, SensorOK: false, BufferedCount: 8},
	}

	nodes := []models.Node{
		{NodeID: "node_1", NodeType: "typeA", Status: routes.ONLINE},
		{NodeID: "node_2", NodeType: "typeB", Status: routes.DEGRADED},
		{NodeID: "node_3", NodeType: "typeC", Status: routes.OFFLINE_INTENDED},
	}

	deviceStore := &InMemoryDeviceStore{db: db, healthRecords: healthRecords, nodes: nodes}
	server := routes.NewServer(deviceStore)

	port := 8080
	addr := fmt.Sprintf(":%d", port)

	log.Printf("Starting server on %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, server))
}
