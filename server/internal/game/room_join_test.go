package game

import (
	"testing"
	"time"

	"dirtyplay-server/internal/protocol"
)

type stubConn struct {
	id string
}

func (c stubConn) ID() string { return c.id }

func (c stubConn) SendMessage(string, any) error { return nil }

func TestHandleJoinClearsStaleFullRoomWhenNoHumansConnected(t *testing.T) {
	room := NewRoom("room-full")
	room.ticker.Stop()

	stalePlayers := make([]*PlayerState, 0, maxPlayers)
	for i := 0; i < maxPlayers; i++ {
		stalePlayers = append(stalePlayers, &PlayerState{
			ID:             "stale-" + string(rune('a'+i)),
			Name:           "stale",
			Seat:           i,
			Stack:          initialStack,
			Status:         StatusOut,
			DisconnectedAt: time.Now().Add(-2 * time.Minute),
		})
	}
	room.state.Players = stalePlayers
	room.state.Phase = PhaseWaiting
	room.conns = map[string]Conn{}

	reply := make(chan EventResult, 1)
	changed := room.handleJoin(Event{
		Type: "join",
		Conn: stubConn{id: "conn-new"},
		Data: protocol.JoinMsg{
			RoomID: room.ID,
			Name:   "newbie",
		},
		Reply: reply,
	})

	if !changed {
		t.Fatalf("expected join to change room state")
	}
	res := <-reply
	if res.Err != nil {
		t.Fatalf("expected join success, got error: %v", res.Err)
	}
	if len(room.state.Players) != 1 {
		t.Fatalf("expected stale room reset to 1 player, got %d", len(room.state.Players))
	}
	if room.state.Players[0].ID != res.PlayerID {
		t.Fatalf("expected joined player id %s, got %s", res.PlayerID, room.state.Players[0].ID)
	}
}

func TestHandleJoinReturnsRoomFullWhenHumansStillConnected(t *testing.T) {
	room := NewRoom("room-live")
	room.ticker.Stop()

	players := make([]*PlayerState, 0, maxPlayers)
	for i := 0; i < maxPlayers; i++ {
		id := "p-" + string(rune('a'+i))
		players = append(players, &PlayerState{
			ID:     id,
			Name:   "p",
			Seat:   i,
			Stack:  initialStack,
			Status: StatusActive,
		})
	}
	room.state.Players = players
	room.state.Phase = PhaseWaiting
	room.conns = map[string]Conn{
		players[0].ID: stubConn{id: "conn-existing"},
	}

	reply := make(chan EventResult, 1)
	changed := room.handleJoin(Event{
		Type: "join",
		Conn: stubConn{id: "conn-new"},
		Data: protocol.JoinMsg{
			RoomID: room.ID,
			Name:   "overflow",
		},
		Reply: reply,
	})

	if changed {
		t.Fatalf("expected join not to change state when room is full with connected humans")
	}
	res := <-reply
	if res.Err == nil || res.Err.Error() != "room full" {
		t.Fatalf("expected room full error, got: %v", res.Err)
	}
}
