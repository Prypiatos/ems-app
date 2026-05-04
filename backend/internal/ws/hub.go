package ws

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

type Hub struct {
	Buffer     map[string]chan []byte
	WSClients  map[string]map[*Client]struct{}
	TopicLocks map[string]*sync.RWMutex
}

func NewHub(topics []string, topicBufferSize int) *Hub {
	wsmap := make(map[string]map[*Client]struct{})
	buffermap := make(map[string]chan []byte)
	lockmap := make(map[string]*sync.RWMutex)
	for _, topic := range topics {
		wsmap[topic] = make(map[*Client]struct{})
		buffermap[topic] = make(chan []byte, topicBufferSize)
		lockmap[topic] = &sync.RWMutex{}
	}

	return &Hub{
		Buffer:     buffermap,
		WSClients:  wsmap,
		TopicLocks: lockmap,
	}
}

func (h *Hub) Register(client *Client, topic string) {
	lock, ok := h.TopicLocks[topic]
	if !ok {
		return
	}

	lock.Lock()
	h.WSClients[topic][client] = struct{}{}
	lock.Unlock()
}

func (h *Hub) Kickout(client *Client, topic string) {
	lock, ok := h.TopicLocks[topic]
	if !ok {
		return
	}

	lock.Lock()
	delete(h.WSClients[topic], client)
	lock.Unlock()

	if err := client.Close(); err != nil {
		slog.Debug("client close error", "topic", topic, "error", err)
	}
}

func (h *Hub) Publish(ctx context.Context, topic string, msg []byte, timeout time.Duration) bool {
	buf, ok := h.Buffer[topic]
	if !ok {
		return false
	}

	if timeout <= 0 {
		select {
		case buf <- msg:
			return true
		default:
			return false
		}
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return false
	case buf <- msg:
		return true
	case <-timer.C:
		return false
	}
}

func (h *Hub) Broadcast(ctx context.Context, topic string) {
	buf, ok := h.Buffer[topic]
	if !ok {
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-buf:
			clients := h.snapshotClients(topic)
			for _, client := range clients {
				if !client.Enqueue(msg) {
					h.Kickout(client, topic)
				}
			}
		}
	}
}

func (h *Hub) snapshotClients(topic string) []*Client {
	lock, ok := h.TopicLocks[topic]
	if !ok {
		return nil
	}

	lock.RLock()
	clients := make([]*Client, 0, len(h.WSClients[topic]))
	for client := range h.WSClients[topic] {
		clients = append(clients, client)
	}
	lock.RUnlock()

	return clients
}
