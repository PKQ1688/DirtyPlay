package ws

import (
	"encoding/json"
	"errors"
	"sync/atomic"
	"time"

	"dirtyplay-server/internal/game"
	"dirtyplay-server/internal/protocol"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
	maxMsgSize = 64 * 1024
)

type Client struct {
	id      string
	hub     *Hub
	conn    *websocket.Conn
	send    chan []byte
	roomMgr *game.RoomManager
	seq     int64
}

func NewClient(hub *Hub, conn *websocket.Conn, roomMgr *game.RoomManager) *Client {
	return &Client{
		id:      uuid.NewString(),
		hub:     hub,
		conn:    conn,
		send:    make(chan []byte, 256),
		roomMgr: roomMgr,
	}
}

func (c *Client) ID() string {
	return c.id
}

func (c *Client) SendMessage(msgType string, payload any) error {
	seq := atomic.AddInt64(&c.seq, 1)
	data, err := protocol.EncodeMessage(msgType, seq, payload)
	if err != nil {
		return err
	}
	select {
	case c.send <- data:
		return nil
	default:
		return errors.New("send buffer full")
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.roomMgr.Disconnect(c)
		_ = c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMsgSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		var msg protocol.Message
		if err := json.Unmarshal(data, &msg); err != nil {
			_ = c.SendMessage("error", protocol.ErrorMsg{
				Code:    400,
				Message: "invalid message",
			})
			continue
		}
		c.roomMgr.HandleMessage(c, msg.Type, msg.Seq, msg.Payload)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
