package ws

import (
	"context"
	"sync"
)

type Hub struct {
	Buffer    chan []byte
	WSClients map[*Client]bool
	Mutex     sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		Buffer:    make(chan []byte, 1),
		WSClients: map[*Client]bool{},
	}
}

func (h *Hub) Register(client *Client) {
	h.Mutex.Lock()
	h.WSClients[client] = true
	h.Mutex.Unlock()
}

func (h *Hub) Kickout(client *Client) {
	h.Mutex.Lock()
	h.WSClients[client] = false
	delete(h.WSClients, client)
	h.Mutex.Unlock()
}

func (h *Hub) Broadcast(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-h.Buffer:
			h.Mutex.Lock()
			for client, clientIsAlive := range h.WSClients {
				if clientIsAlive {
					client.Buffer <- msg
				} else {
					client.Conn.Close()
					h.WSClients[client] = false
					delete(h.WSClients, client)
				}
			}
			h.Mutex.Unlock()
		}
	}
}
