package game

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"dirtyplay-server/internal/protocol"
)

type Session struct {
	RoomID   string
	PlayerID string
}

type RoomManager struct {
	mu       sync.Mutex
	rooms    map[string]*Room
	sessions map[string]*Session
	players  map[string]string
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms:    make(map[string]*Room),
		sessions: make(map[string]*Session),
		players:  make(map[string]string),
	}
}

func (rm *RoomManager) HandleMessage(conn Conn, msgType string, seq int64, payload json.RawMessage) {
	switch msgType {
	case "join":
		var join protocol.JoinMsg
		if err := json.Unmarshal(payload, &join); err != nil || join.RoomID == "" {
			_ = conn.SendMessage("error", protocol.ErrorMsg{Code: 400, Message: "invalid join payload"})
			return
		}
		prevSession, prevRoom := rm.currentSession(conn.ID())
		room := rm.getOrCreateRoom(join.RoomID)
		reply := make(chan EventResult, 1)
		room.eventCh <- Event{
			Type:  "join",
			Conn:  conn,
			Data:  join,
			Reply: reply,
		}
		select {
		case res := <-reply:
			if res.Err != nil {
				_ = conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: res.Err.Error()})
				return
			}
			if prevSession != nil && (prevSession.PlayerID != res.PlayerID || prevSession.RoomID != join.RoomID) && prevRoom != nil {
				prevRoom.eventCh <- Event{
					Type:     "leave",
					PlayerID: prevSession.PlayerID,
					Conn:     conn,
				}
			}
			rm.mu.Lock()
			if prevSession != nil {
				if existing, ok := rm.players[prevSession.PlayerID]; ok && existing == conn.ID() {
					delete(rm.players, prevSession.PlayerID)
				}
			}
			if oldConnID, ok := rm.players[res.PlayerID]; ok && oldConnID != conn.ID() {
				delete(rm.sessions, oldConnID)
			}
			rm.sessions[conn.ID()] = &Session{RoomID: join.RoomID, PlayerID: res.PlayerID}
			rm.players[res.PlayerID] = conn.ID()
			rm.mu.Unlock()
			_ = conn.SendMessage("ack", protocol.AckMsg{Success: true, PlayerID: res.PlayerID})
		case <-time.After(2 * time.Second):
			_ = conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "join timeout"})
		}
	case "action":
		var action protocol.ActionMsg
		if err := json.Unmarshal(payload, &action); err != nil {
			_ = conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid action payload"})
			return
		}
		session, room, err := rm.sessionRoom(conn.ID())
		if err != nil {
			_ = conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: err.Error()})
			return
		}
		room.eventCh <- Event{
			Type:     "action",
			PlayerID: session.PlayerID,
			Conn:     conn,
			Data:     action,
		}
	case "skill":
		var skillMsg protocol.SkillMsg
		if err := json.Unmarshal(payload, &skillMsg); err != nil {
			_ = conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid skill payload"})
			return
		}
		session, room, err := rm.sessionRoom(conn.ID())
		if err != nil {
			_ = conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: err.Error()})
			return
		}
		room.eventCh <- Event{
			Type:     "skill",
			PlayerID: session.PlayerID,
			Conn:     conn,
			Data:     skillMsg,
		}
	case "ping":
		_ = conn.SendMessage("pong", map[string]string{"ts": time.Now().Format(time.RFC3339Nano)})
	default:
		_ = conn.SendMessage("error", protocol.ErrorMsg{Code: 404, Message: "unknown message type"})
	}
}

func (rm *RoomManager) currentSession(connID string) (*Session, *Room) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	s, ok := rm.sessions[connID]
	if !ok {
		return nil, nil
	}
	session := &Session{
		RoomID:   s.RoomID,
		PlayerID: s.PlayerID,
	}
	room := rm.rooms[session.RoomID]
	return session, room
}

func (rm *RoomManager) Disconnect(conn Conn) {
	session, room, err := rm.sessionRoom(conn.ID())
	if err == nil {
		room.eventCh <- Event{
			Type:     "leave",
			PlayerID: session.PlayerID,
			Conn:     conn,
		}
	}
	rm.mu.Lock()
	if session != nil {
		if existing, ok := rm.players[session.PlayerID]; ok && existing == conn.ID() {
			delete(rm.players, session.PlayerID)
		}
	}
	delete(rm.sessions, conn.ID())
	rm.mu.Unlock()
}

func (rm *RoomManager) getOrCreateRoom(roomID string) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	if room, ok := rm.rooms[roomID]; ok {
		return room
	}
	room := NewRoom(roomID)
	rm.rooms[roomID] = room
	go room.EventLoop()
	return room
}

func (rm *RoomManager) sessionRoom(connID string) (*Session, *Room, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	session, ok := rm.sessions[connID]
	if !ok {
		return nil, nil, errors.New("not joined")
	}
	room, ok := rm.rooms[session.RoomID]
	if !ok {
		return nil, nil, errors.New("room not found")
	}
	return session, room, nil
}
