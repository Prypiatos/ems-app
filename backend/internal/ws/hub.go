package ws

import (
	"context"
	"sync"
)

type Hub struct {
	Buffer    map[string]chan []byte
	WSClients map[string]map[*Client]bool
	Mutex     sync.Mutex
}

func NewHub(topics []string) *Hub {
	wsmap := make(map[string]map[*Client]bool)
	buffermap := make(map[string]chan []byte)
	for _, topic := range topics {
		wsmap[topic] = make(map[*Client]bool)
		buffermap[topic] = make(chan []byte, 1)
	}

	return &Hub{
		Buffer:    buffermap,
		WSClients: wsmap,
	}
}

func (h *Hub) Register(client *Client, topic string) {
	h.Mutex.Lock()
	h.WSClients[topic][client] = true
	h.Mutex.Unlock()
}

func (h *Hub) Kickout(client *Client, topic string) {
	h.Mutex.Lock()
	h.WSClients[topic][client] = false
	delete(h.WSClients[topic], client)
	h.Mutex.Unlock()
}

func (h *Hub) Broadcast(ctx context.Context, topic string) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-h.Buffer[topic]:
			h.Mutex.Lock()
			for client, clientIsAlive := range h.WSClients[topic] {
				if clientIsAlive {
					client.Buffer <- msg
				} else {
					client.Conn.Close()
					h.WSClients[topic][client] = false
					delete(h.WSClients[topic], client)
				}
			}
			h.Mutex.Unlock()
		}
	}
}
