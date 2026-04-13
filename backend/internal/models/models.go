package models

type EnergyReading struct {
	NodeID          string  `json:"node_id"`   // Unique node identifier
	Timestamp       int64   `json:"timestamp"` // Message creation time in epoch ms
	Voltage         float32 `json:"voltage"`   // Voltage in volts
	Current         float32 `json:"current"`   // Current in amps
	Power           float32 `json:"power"`     // Active power in watts
	EnergyWattHours float32 `json:"energy_wh"` // Cumulative energy in watt-hours
}

type Event struct {
	NodeID    string `json:"node_id"`    // Unique node identifier
	Timestamp int64  `json:"timestamp"`  // Event time in epoch ms
	EventType string `json:"event_type"` // Type of event (power_spike, overload_warning, power_down)
	Severity  string `json:"severity"`   // low, medium, high, critical
	Message   string `json:"message"`    // Short human-readable description
}

type HealthStatus struct {
	NodeID        string `json:"node_id"`        // Unique node identifier
	Timestamp     int64  `json:"timestamp"`      // Heartbeat time
	Status        string `json:"status"`         // online, degraded, or offline_intended
	Uptime        int64  `json:"uptime"`         // Time since boot
	MQTTConnected bool   `json:"mqtt_connected"` // MQTT connection status
	WifiConnected bool   `json:"wifi_connected"` // Wi-Fi connection status
	SensorOK      bool   `json:"sensor_ok"`      // Sensor read health
	BufferedCount int    `json:"buffered_count"` // Number of unsent buffered messages
}

type Node struct {
	NodeID   string `json:"node_id"`   // Unique node identifier
	NodeType string `json:"node_type"` // Type of device
	Status   string `json:"status"`    // online, degraded, or offline_intended
}
