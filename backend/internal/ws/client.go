package ws

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	Buffer        chan []byte
	Conn          *websocket.Conn
	oneClose      sync.Once
	writeDeadline time.Duration
	readDeadline  time.Duration
	pingInterval  time.Duration
}

func NewClient(conn *websocket.Conn, bufferSize int, writeDeadline time.Duration, readDeadline time.Duration, pingInterval time.Duration) *Client {
	c := &Client{
		Buffer:        make(chan []byte, bufferSize),
		Conn:          conn,
		writeDeadline: writeDeadline,
		readDeadline:  readDeadline,
		pingInterval:  pingInterval,
	}
	if c.readDeadline > 0 {
		_ = c.Conn.SetReadDeadline(time.Now().Add(c.readDeadline))
	}
	// extend read deadline on pong
	c.Conn.SetPongHandler(func(appData string) error {
		if c.readDeadline > 0 {
			_ = c.Conn.SetReadDeadline(time.Now().Add(c.readDeadline))
		}
		return nil
	})
	return c
}

func (c *Client) Enqueue(msg []byte) bool {
	select {
	case c.Buffer <- msg:
		return true
	default:
		return false
	}
}

func (c *Client) Close() error {
	var closeErr error
	c.oneClose.Do(func() {
		close(c.Buffer)
		closeErr = c.Conn.Close()
	})
	return closeErr
}

func (c *Client) Write(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-c.Buffer:
			if !ok {
				return
			}
			if c.writeDeadline > 0 {
				_ = c.Conn.SetWriteDeadline(time.Now().Add(c.writeDeadline))
			}
			err := c.Conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				if errors.Is(err, websocket.ErrCloseSent) {
					return
				}
				log.Println("write:", err)
				return
			}
		}
	}
}

// PingLoop sends periodic pings and relies on pong handler to extend read deadline.
func (c *Client) PingLoop(ctx context.Context) {
	if c.pingInterval <= 0 {
		return
	}
	ticker := time.NewTicker(c.pingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if c.writeDeadline > 0 {
				_ = c.Conn.SetWriteDeadline(time.Now().Add(c.writeDeadline))
			}
			if err := c.Conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second)); err != nil {
				log.Println("ping error:", err)
				return
			}
		}
	}
}
