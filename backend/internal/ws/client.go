package ws

import (
	"context"
	"log"

	"github.com/gorilla/websocket"
)

type Client struct {
	Buffer chan []byte
	Conn   *websocket.Conn
}

func NewClient(conn *websocket.Conn) *Client {
	return &Client{
		Buffer: make(chan []byte, 10),
		Conn:   conn,
	}
}

func (c *Client) Write(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-c.Buffer:
			err := c.Conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				log.Println("write:", err)
				return
			}
		}
	}
}
