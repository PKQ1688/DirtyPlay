package ws

import (
	"net/http"

	"dirtyplay-server/internal/game"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func ServeWS(hub *Hub, roomMgr *game.RoomManager, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := NewClient(hub, conn, roomMgr)
	hub.register <- client
	go client.writePump()
	go client.readPump()
}
