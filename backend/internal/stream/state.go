package stream

import (
	"slices"
	"sync"
)

type Event struct {
	NodeID    string `json:"node_id"`
	NodeType  string `json:"node_type"`
	Timestamp int64  `json:"timestamp"`
	EventType string `json:"event_type"`
	Severity  string `json:"severity"`
	Message   string `json:"message"`
	Buffered  bool   `json:"buffered"`
}

type Health struct {
	NodeID        string `json:"node_id"`
	NodeType      string `json:"node_type"`
	Timestamp     int64  `json:"timestamp"`
	SequenceNo    int64  `json:"sequence_no"`
	Status        string `json:"status"`
	UptimeSec     int64  `json:"uptime_sec"`
	MQTTConnected bool   `json:"mqtt_connected"`
	WiFiConnected bool   `json:"wifi_connected"`
	SensorOK      bool   `json:"sensor_ok"`
	BufferedCount int64  `json:"buffered_count"`
}

type State struct {
	mu           sync.RWMutex
	recentEvents map[string][]Event
	latestHealth map[string]Health
	nodes        map[string]struct{}
}

func NewState() *State {
	return &State{
		recentEvents: make(map[string][]Event),
		latestHealth: make(map[string]Health),
		nodes:        make(map[string]struct{}),
	}
}

func (s *State) AddEvent(event Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nodes[event.NodeID] = struct{}{}

	events := append([]Event{event}, s.recentEvents[event.NodeID]...)
	if len(events) > 100 {
		events = events[:100]
	}
	s.recentEvents[event.NodeID] = events
}

func (s *State) SetHealth(health Health) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nodes[health.NodeID] = struct{}{}
	s.latestHealth[health.NodeID] = health
}

func (s *State) MarkNode(nodeID string) {
	if nodeID == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nodes[nodeID] = struct{}{}
}

func (s *State) GetEvents(nodeID string, limit int) []Event {
	s.mu.RLock()
	defer s.mu.RUnlock()

	events := s.recentEvents[nodeID]
	if limit <= 0 || limit > len(events) {
		limit = len(events)
	}
	out := make([]Event, limit)
	copy(out, events[:limit])
	return out
}

func (s *State) GetHealth(nodeID string) (Health, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	health, ok := s.latestHealth[nodeID]
	return health, ok
}

func (s *State) ListNodes() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.nodes))
	for nodeID := range s.nodes {
		out = append(out, nodeID)
	}
	slices.Sort(out)
	return out
}
