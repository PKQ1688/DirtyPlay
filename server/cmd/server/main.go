package main

import (
	"log"
	"net/http"

	"dirtyplay-server/internal/game"
	"dirtyplay-server/internal/ws"
)

func main() {
	hub := ws.NewHub()
	roomMgr := game.NewRoomManager()
	go hub.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, roomMgr, w, r)
	})

	addr := ":8080"
	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
