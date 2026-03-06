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

func TestHandleJoinReconnectPreservesWaitingRoomWithBots(t *testing.T) {
	room := NewRoom("room-reconnect")
	room.ticker.Stop()

	human := &PlayerState{
		ID:             "human-1",
		Name:           "host",
		Seat:           0,
		Stack:          initialStack,
		Status:         StatusOut,
		DisconnectedAt: time.Now().Add(-2 * time.Second),
	}
	bot := &PlayerState{
		ID:     "bot-1",
		Name:   "bot",
		Seat:   1,
		Stack:  initialStack,
		Status: StatusActive,
		IsBot:  true,
	}
	room.state.Players = []*PlayerState{human, bot}
	room.state.Phase = PhaseWaiting
	room.disconnected = map[string]time.Time{
		human.ID: human.DisconnectedAt,
	}

	reply := make(chan EventResult, 1)
	changed := room.handleJoin(Event{
		Type: "join",
		Conn: stubConn{id: "conn-reconnect"},
		Data: protocol.JoinMsg{
			RoomID:   room.ID,
			PlayerID: human.ID,
			Name:     "host-returned",
		},
		Reply: reply,
	})

	if !changed {
		t.Fatalf("expected reconnect to change room state")
	}
	res := <-reply
	if res.Err != nil {
		t.Fatalf("expected reconnect success, got error: %v", res.Err)
	}
	if len(room.state.Players) != 2 {
		t.Fatalf("expected reconnect to preserve bot, got %d players", len(room.state.Players))
	}
	rejoined := room.state.PlayerByID(human.ID)
	if rejoined == nil {
		t.Fatalf("expected rejoined human to stay in room")
	}
	if rejoined.Name != "host-returned" {
		t.Fatalf("expected updated name, got %q", rejoined.Name)
	}
	if rejoined.Status != StatusActive {
		t.Fatalf("expected rejoined human to reactivate in waiting room, got %q", rejoined.Status)
	}
	if !rejoined.DisconnectedAt.IsZero() {
		t.Fatalf("expected reconnect to clear disconnection timestamp")
	}
	if _, ok := room.conns[human.ID]; !ok {
		t.Fatalf("expected reconnect to restore live connection")
	}
}

func TestEndHandKeepsDisconnectedHumansForReconnectGrace(t *testing.T) {
	room := NewRoom("room-end-hand")
	room.ticker.Stop()

	human := &PlayerState{
		ID:             "human-1",
		Name:           "host",
		Seat:           0,
		Stack:          initialStack - 10,
		Bet:            10,
		TotalBet:       10,
		Status:         StatusOut,
		Hand:           nil,
		DisconnectedAt: time.Now().Add(-2 * time.Second),
	}
	bot := &PlayerState{
		ID:       "bot-1",
		Name:     "bot",
		Seat:     1,
		Stack:    initialStack + 10,
		Status:   StatusActive,
		IsBot:    true,
		Bet:      0,
		TotalBet: 0,
	}
	room.state.Players = []*PlayerState{human, bot}
	room.state.Phase = PhaseShowdown
	room.disconnected = map[string]time.Time{
		human.ID: human.DisconnectedAt,
	}

	room.endHand()

	if room.state.Phase != PhaseWaiting {
		t.Fatalf("expected room to return to waiting, got %q", room.state.Phase)
	}
	if len(room.state.Players) != 2 {
		t.Fatalf("expected disconnected human to be retained with bot, got %d players", len(room.state.Players))
	}
	retained := room.state.PlayerByID(human.ID)
	if retained == nil {
		t.Fatalf("expected disconnected human to remain until eviction timeout")
	}
	if retained.Status != StatusOut {
		t.Fatalf("expected disconnected human to stay out while waiting to reconnect, got %q", retained.Status)
	}
	if retained.Bet != 0 || retained.TotalBet != 0 {
		t.Fatalf("expected disconnected human bets to reset after hand, got bet=%d total=%d", retained.Bet, retained.TotalBet)
	}
}

func TestHandleLeaveKeepsActiveHandReconnectable(t *testing.T) {
	room := NewRoom("room-active-leave")
	room.ticker.Stop()

	human := &PlayerState{
		ID:     "human-1",
		Name:   "host",
		Seat:   0,
		Stack:  initialStack,
		Status: StatusActive,
		Hand:   nil,
	}
	bot := &PlayerState{
		ID:     "bot-1",
		Name:   "bot",
		Seat:   1,
		Stack:  initialStack,
		Status: StatusActive,
		IsBot:  true,
	}
	room.state.Players = []*PlayerState{human, bot}
	room.state.Phase = PhasePreFlop
	room.state.CurrentPlayer = human.ID
	room.state.ActionRequestedAt = time.Now().Add(-2 * time.Second)
	room.conns = map[string]Conn{
		human.ID: stubConn{id: "conn-human"},
	}

	changed := room.handleLeave(Event{
		Type:     "leave",
		PlayerID: human.ID,
		Conn:     stubConn{id: "conn-human"},
	})

	if changed {
		t.Fatalf("expected active-hand disconnect not to resolve hand immediately")
	}
	if human.Status != StatusActive {
		t.Fatalf("expected disconnected player to remain active for reconnect window, got %q", human.Status)
	}
	if len(room.state.RecentActions) != 0 {
		t.Fatalf("expected disconnect not to append synthetic action, got %d records", len(room.state.RecentActions))
	}
	if human.DisconnectedAt.IsZero() {
		t.Fatalf("expected disconnect timestamp to be recorded")
	}
	if _, ok := room.conns[human.ID]; ok {
		t.Fatalf("expected live connection to be removed")
	}
}

func TestSendActionRequestStartsTimeoutForDisconnectedCurrentPlayer(t *testing.T) {
	room := NewRoom("room-disconnected-turn")
	room.ticker.Stop()

	human := &PlayerState{
		ID:     "human-1",
		Name:   "host",
		Seat:   0,
		Stack:  initialStack,
		Status: StatusActive,
	}
	bot := &PlayerState{
		ID:     "bot-1",
		Name:   "bot",
		Seat:   1,
		Stack:  initialStack,
		Status: StatusActive,
		IsBot:  true,
	}
	room.state.Players = []*PlayerState{human, bot}
	room.state.Phase = PhasePreFlop
	room.state.CurrentPlayer = human.ID
	room.state.CurrentBet = room.state.BigBlind
	room.state.MinRaise = room.state.BigBlind
	room.state.ActionRequestedAt = time.Time{}

	room.sendActionRequest()

	if room.state.ActionRequestedAt.IsZero() {
		t.Fatalf("expected disconnected current player to start an action timeout window")
	}
}
