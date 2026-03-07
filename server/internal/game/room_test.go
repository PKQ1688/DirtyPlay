package game

import (
	"testing"
	"time"

	"dirtyplay-server/internal/poker"
	"dirtyplay-server/internal/protocol"
	"dirtyplay-server/internal/skill"
)

type capturedMessage struct {
	msgType string
	payload any
}

type testConn struct {
	id       string
	messages []capturedMessage
}

func (c *testConn) ID() string {
	return c.id
}

func (c *testConn) SendMessage(msgType string, payload any) error {
	c.messages = append(c.messages, capturedMessage{msgType: msgType, payload: payload})
	return nil
}

func (c *testConn) lastAck() (protocol.AckMsg, bool) {
	for i := len(c.messages) - 1; i >= 0; i-- {
		if c.messages[i].msgType != "ack" {
			continue
		}
		ack, ok := c.messages[i].payload.(protocol.AckMsg)
		return ack, ok
	}
	return protocol.AckMsg{}, false
}

func (c *testConn) messageCount(msgType string) int {
	count := 0
	for _, message := range c.messages {
		if message.msgType == msgType {
			count++
		}
	}
	return count
}

func newHumanPlayer(id string, seat int) *PlayerState {
	return &PlayerState{
		ID:     id,
		Name:   "Player" + id,
		Seat:   seat,
		Stack:  initialStack,
		Status: StatusActive,
	}
}

func newBotPlayer(id string, seat int) *PlayerState {
	return &PlayerState{
		ID:     id,
		Name:   "Bot" + id,
		Seat:   seat,
		Stack:  initialStack,
		Status: StatusActive,
		IsBot:  true,
	}
}

func makeCard(rank int, suit poker.Suit) poker.Card {
	return poker.Card{Rank: rank, Suit: suit}
}

func setupSkillRoom(skillID string) (*Room, *PlayerState, *PlayerState, *testConn) {
	room := NewRoom("room-skill")
	actor := newHumanPlayer("p1", 0)
	target := newHumanPlayer("p2", 1)
	actor.Hand = []poker.Card{makeCard(14, poker.Spades), makeCard(13, poker.Hearts)}
	target.Hand = []poker.Card{makeCard(12, poker.Clubs), makeCard(11, poker.Diamonds)}
	actor.Skills = []skill.Card{{ID: skillID, Name: skillID, Cost: 15}}
	room.state.Players = []*PlayerState{actor, target}
	room.state.Phase = PhaseFlop
	room.state.CurrentPlayer = actor.ID
	room.state.CurrentBet = 10
	room.state.MinRaise = 10
	conn := &testConn{id: actor.ID}
	room.conns[actor.ID] = conn
	return room, actor, target, conn
}

func TestWaitingRoomAutoStartRequiresTwoConnectedHumans(t *testing.T) {
	room := NewRoom("room-waiting")
	host := newHumanPlayer("host", 0)
	room.state.Players = []*PlayerState{host}
	room.conns[host.ID] = &testConn{id: host.ID}

	if !room.addOneBot() {
		t.Fatal("expected addOneBot to succeed")
	}
	if room.shouldAutoStartWaitingHand() {
		t.Fatal("single human plus bot should not auto-start")
	}

	guest := newHumanPlayer("guest", 2)
	room.state.Players = append(room.state.Players, guest)
	room.conns[guest.ID] = &testConn{id: guest.ID}
	if !room.shouldAutoStartWaitingHand() {
		t.Fatal("two connected humans should auto-start")
	}
}

func TestHandleStartGameStartsHumanBotRoom(t *testing.T) {
	room := NewRoom("room-start")
	host := newHumanPlayer("host", 0)
	conn := &testConn{id: host.ID}
	room.state.Players = []*PlayerState{host}
	room.conns[host.ID] = conn

	if !room.addOneBot() {
		t.Fatal("expected addOneBot to succeed")
	}

	changed := room.handleStartGame(Event{
		Type:     "start_game",
		PlayerID: host.ID,
		Conn:     conn,
	})
	if !changed {
		t.Fatal("expected manual start to change room state")
	}
	if room.state.Phase != PhasePreFlop {
		t.Fatalf("expected room to enter preflop, got %s", room.state.Phase)
	}

	ack, ok := conn.lastAck()
	if !ok || !ack.Success {
		t.Fatalf("expected success ack, got %#v", ack)
	}
}

func TestCheckTimeoutsFoldsDisconnectedCurrentPlayerAfterEvictTimeout(t *testing.T) {
	room := NewRoom("room-timeout")
	p1 := newHumanPlayer("p1", 0)
	p2 := newHumanPlayer("p2", 1)
	p3 := newBotPlayer("b1", 2)
	room.state.Players = []*PlayerState{p1, p2, p3}
	room.state.Phase = PhasePreFlop
	room.state.CurrentPlayer = p1.ID
	room.state.CurrentBet = 10
	room.state.MinRaise = 10
	room.disconnected[p1.ID] = time.Now().Add(-(evictTimeout + time.Second))

	changed := room.checkTimeouts()
	if !changed {
		t.Fatal("expected timeout processing to change room state")
	}
	if p1.Status != StatusFolded {
		t.Fatalf("expected disconnected player to fold, got %s", p1.Status)
	}
	if room.state.CurrentPlayer == p1.ID {
		t.Fatal("expected current player to advance after disconnect fold")
	}
}

func TestHandleSkillRejectsPassiveCounter(t *testing.T) {
	room, actor, _, conn := setupSkillRoom("counter")
	room.state.Phase = PhasePreFlop

	changed := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: actor.ID,
		Conn:     conn,
		Data:     protocol.SkillMsg{SkillID: "counter"},
	})
	if changed {
		t.Fatal("expected passive counter to be rejected")
	}

	ack, ok := conn.lastAck()
	if !ok || ack.Error != "counter is passive" {
		t.Fatalf("expected counter passive error, got %#v", ack)
	}
}

func TestHandleSkillRejectsMistBeforeFlop(t *testing.T) {
	room, actor, _, conn := setupSkillRoom("mist")
	room.state.Phase = PhasePreFlop
	room.state.Community = nil

	changed := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: actor.ID,
		Conn:     conn,
		Data:     protocol.SkillMsg{SkillID: "mist"},
	})
	if changed {
		t.Fatal("expected mist to be rejected before community cards")
	}

	ack, ok := conn.lastAck()
	if !ok || ack.Error != "no community cards" {
		t.Fatalf("expected no community cards error, got %#v", ack)
	}
}

func TestHandleSkillPeekAppliesHeatAndConsumesSkill(t *testing.T) {
	room, actor, target, conn := setupSkillRoom("peek")
	room.state.Community = []poker.Card{makeCard(2, poker.Spades), makeCard(7, poker.Hearts), makeCard(9, poker.Clubs)}

	changed := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: actor.ID,
		Conn:     conn,
		Data:     protocol.SkillMsg{SkillID: "peek", TargetID: target.ID},
	})
	if !changed {
		t.Fatal("expected peek to succeed")
	}
	if actor.Heat != 15 {
		t.Fatalf("expected peek to add 15 heat, got %d", actor.Heat)
	}
	if !actor.SkillUsedThisTurn {
		t.Fatal("expected actor to be marked as having used a skill this turn")
	}
	if len(actor.Skills) != 0 {
		t.Fatalf("expected used skill to be removed, got %d remaining", len(actor.Skills))
	}
	if conn.messageCount("skill_effect") != 1 {
		t.Fatalf("expected one skill_effect message, got %d", conn.messageCount("skill_effect"))
	}

	ack, ok := conn.lastAck()
	if !ok || !ack.Success {
		t.Fatalf("expected success ack, got %#v", ack)
	}
}

func TestHandleSkillRejectsSecondUseInSameTurn(t *testing.T) {
	room, actor, target, conn := setupSkillRoom("peek")
	actor.SkillUsedThisTurn = true

	changed := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: actor.ID,
		Conn:     conn,
		Data:     protocol.SkillMsg{SkillID: "peek", TargetID: target.ID},
	})
	if changed {
		t.Fatal("expected second skill use in same turn to be rejected")
	}

	ack, ok := conn.lastAck()
	if !ok || ack.Error != "skill already used" {
		t.Fatalf("expected skill already used error, got %#v", ack)
	}
}

func TestHandleSkillRejectsHeatLock(t *testing.T) {
	room, actor, target, conn := setupSkillRoom("peek")
	actor.Heat = skill.LockoutThreshold

	changed := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: actor.ID,
		Conn:     conn,
		Data:     protocol.SkillMsg{SkillID: "peek", TargetID: target.ID},
	})
	if changed {
		t.Fatal("expected heat lock to reject skill usage")
	}

	ack, ok := conn.lastAck()
	if !ok || ack.Error != "heat locked" {
		t.Fatalf("expected heat locked error, got %#v", ack)
	}
}

func TestEndHandDecaysHeatAndReturnsToWaiting(t *testing.T) {
	room := NewRoom("room-endhand")
	p1 := newHumanPlayer("p1", 0)
	p2 := newHumanPlayer("p2", 1)
	p1.Heat = 25
	p2.Heat = 5
	room.state.Players = []*PlayerState{p1, p2}
	room.state.Phase = PhaseShowdown
	room.state.CurrentPlayer = p1.ID
	room.state.Community = []poker.Card{makeCard(2, poker.Spades)}

	room.endHand()

	if p1.Heat != 15 || p2.Heat != 0 {
		t.Fatalf("expected heat decay to 15 and 0, got %d and %d", p1.Heat, p2.Heat)
	}
	if room.state.Phase != PhaseWaiting {
		t.Fatalf("expected room to return to waiting, got %s", room.state.Phase)
	}
	if room.state.CurrentPlayer != "" {
		t.Fatalf("expected current player to reset, got %q", room.state.CurrentPlayer)
	}
}

func TestCalculatePotsCreatesSidePotsForAllIn(t *testing.T) {
	p1 := newHumanPlayer("p1", 0)
	p2 := newHumanPlayer("p2", 1)
	p3 := newHumanPlayer("p3", 2)
	p1.TotalBet = 100
	p2.TotalBet = 200
	p3.TotalBet = 200
	p1.Status = StatusAllIn

	pots := CalculatePots([]*PlayerState{p1, p2, p3})
	if len(pots) != 2 {
		t.Fatalf("expected main pot and side pot, got %d", len(pots))
	}
	if pots[0].Amount != 300 || pots[1].Amount != 200 {
		t.Fatalf("expected pot amounts 300 and 200, got %d and %d", pots[0].Amount, pots[1].Amount)
	}
}

func TestDisplayPotsKeepsBlindsInSingleMainPotUntilAllIn(t *testing.T) {
	p1 := newHumanPlayer("p1", 0)
	p2 := newHumanPlayer("p2", 1)
	p1.TotalBet = 5
	p2.TotalBet = 10

	pots := displayPots(&GameState{Players: []*PlayerState{p1, p2}})
	if len(pots) != 1 {
		t.Fatalf("expected one main pot before any all-in, got %d pots", len(pots))
	}
	if pots[0].Amount != 15 {
		t.Fatalf("expected main pot amount 15, got %d", pots[0].Amount)
	}
}
