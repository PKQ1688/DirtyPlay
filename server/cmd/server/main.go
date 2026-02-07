package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"dirtyplay-server/internal/game"
	"dirtyplay-server/internal/ws"
)

func main() {
	hub := ws.NewHub()
	roomMgr := game.NewRoomManager()
	go hub.Run()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, roomMgr, w, r)
	})
	webDir := resolveWebDir()
	mux.Handle("/", http.FileServer(http.Dir(webDir)))

	addr := ":8080"
	log.Printf("web root: %s", webDir)
	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func resolveWebDir() string {
	if custom := os.Getenv("DIRTYPLAY_WEB_DIR"); custom != "" {
		return custom
	}
	candidates := []string{
		filepath.Clean("./web"),
		filepath.Clean("../web"),
	}
	for _, dir := range candidates {
		if _, err := os.Stat(filepath.Join(dir, "index.html")); err == nil {
			return dir
		}
	}
	return filepath.Clean("./web")
}
