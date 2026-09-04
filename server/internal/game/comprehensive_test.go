package game

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"dirtyplay-server/internal/poker"
	"dirtyplay-server/internal/protocol"
	"dirtyplay-server/internal/skill"
)

// Helper to make cards easily
func c(rank int, suit poker.Suit) poker.Card {
	return poker.Card{Rank: rank, Suit: suit}
}

func TestMultiLayerSidePotsWithShowdown(t *testing.T) {
	// 4 Players with varying stacks:
	// P1 (50 chips) -> Hand: High Card (9-high)
	// P2 (150 chips) -> Hand: Pair of Aces
	// P3 (300 chips) -> Hand: Flush
	// P4 (500 chips) -> Hand: Full House
	room := NewRoom("room-pots-test")
	room.ticker.Stop()

	p1 := newHumanPlayer("p1", 0)
	p1.Stack = 0
	p1.Bet = 50
	p1.TotalBet = 50
	p1.Status = StatusAllIn
	p1.Hand = []poker.Card{c(2, poker.Hearts), c(3, poker.Clubs)}

	p2 := newHumanPlayer("p2", 1)
	p2.Stack = 0
	p2.Bet = 150
	p2.TotalBet = 150
	p2.Status = StatusAllIn
	p2.Hand = []poker.Card{c(14, poker.Hearts), c(4, poker.Clubs)}

	p3 := newHumanPlayer("p3", 2)
	p3.Stack = 0
	p3.Bet = 300
	p3.TotalBet = 300
	p3.Status = StatusAllIn
	p3.Hand = []poker.Card{c(6, poker.Diamonds), c(8, poker.Diamonds)}

	p4 := newHumanPlayer("p4", 3)
	p4.Stack = 0
	p4.Bet = 500
	p4.TotalBet = 500
	p4.Status = StatusAllIn
	p4.Hand = []poker.Card{c(10, poker.Hearts), c(10, poker.Spades)}

	room.state.Players = []*PlayerState{p1, p2, p3, p4}
	// Community: 10D, 10C, 9D, KD, AD
	// p1: 2H, 3C + Comm -> Pair of 10s (category 1)
	// p2: AH, 4C + Comm -> Two Pair (Aces & 10s, category 2)
	// p3: 6D, 8D + Comm -> Diamond Flush (category 5)
	// p4: 10H, 10S + Comm -> Four of a Kind 10s (category 7)
	room.state.Community = []poker.Card{
		c(10, poker.Diamonds),
		c(10, poker.Clubs),
		c(9, poker.Diamonds),
		c(13, poker.Diamonds),
		c(14, poker.Diamonds),
	}

	room.showdown()

	if room.state.LastResult == nil {
		t.Fatalf("expected LastResult to be populated")
	}

	// Expected pots calculation:
	// Main pot: (50 * 4) = 200 -> Contenders: P1, P2, P3, P4 -> Best: P4 (Four of a Kind) wins 200
	// Side pot 1: (100 * 3) = 300 -> Contenders: P2, P3, P4 -> Best: P4 wins 300
	// Side pot 2: (150 * 2) = 300 -> Contenders: P3, P4 -> Best: P4 wins 300
	// Side pot 3: (200 * 1) = 200 -> Contenders: P4 -> Best: P4 wins 200
	// Total won by P4: 1000 chips (all chips returned)
	if p4.Stack != 1000 {
		t.Fatalf("expected P4 to win all 1000 chips, got %d", p4.Stack)
	}
	if p1.Stack != 0 || p2.Stack != 0 || p3.Stack != 0 {
		t.Fatalf("expected P1, P2, P3 to have 0 stack, got p1=%d, p2=%d, p3=%d", p1.Stack, p2.Stack, p3.Stack)
	}
}

func TestSplitPotWithRemainderChips(t *testing.T) {
	room := NewRoom("room-split-pot")
	room.ticker.Stop()
	room.state.DealerSeat = 0

	// 2 players tie, with a third folded player who contributed 1 chip (making total pot 101)
	p1 := newHumanPlayer("p1", 0) // Dealer
	p1.Stack = 0
	p1.TotalBet = 50
	p1.Hand = []poker.Card{c(14, poker.Spades), c(13, poker.Hearts)}

	p2 := newHumanPlayer("p2", 1) // Next after dealer
	p2.Stack = 0
	p2.TotalBet = 50
	p2.Hand = []poker.Card{c(14, poker.Hearts), c(13, poker.Diamonds)}

	p3 := newHumanPlayer("p3", 2)
	p3.Stack = 0
	p3.TotalBet = 1
	p3.Status = StatusFolded

	room.state.Players = []*PlayerState{p1, p2, p3}
	room.state.Community = []poker.Card{
		c(2, poker.Clubs),
		c(4, poker.Diamonds),
		c(6, poker.Hearts),
		c(8, poker.Spades),
		c(10, poker.Clubs),
	}

	room.showdown()

	// 101 chips total:
	// Pot 1 (1*3=3 chips, eligible [p1, p2]): 3/2 = 1 each, remainder 1 to P2 (seat 1 after dealer 0) -> p2 gets 2, p1 gets 1
	// Pot 2 (49*2=98 chips, eligible [p1, p2]): 98/2 = 49 each
	// Total: p2 = 49 + 2 = 51, p1 = 49 + 1 = 50
	if p2.Stack != 51 || p1.Stack != 50 {
		t.Fatalf("expected P2=51, P1=50, got P2=%d, P1=%d", p2.Stack, p1.Stack)
	}
}

func TestPeekBlockedByCounter(t *testing.T) {
	room := NewRoom("room-peek-counter")
	room.ticker.Stop()

	attacker := newHumanPlayer("attacker", 0)
	attacker.Hand = []poker.Card{c(14, poker.Spades), c(13, poker.Spades)}
	attacker.Skills = []skill.Card{{ID: "peek", Name: "Peek", Cost: 15}}

	defender := newHumanPlayer("defender", 1)
	defender.Hand = []poker.Card{c(10, poker.Hearts), c(9, poker.Hearts)}
	defender.Skills = []skill.Card{{ID: "counter", Name: "Counter", Cost: 5}}

	room.state.Players = []*PlayerState{attacker, defender}
	room.state.Phase = PhaseFlop
	room.state.CurrentPlayer = attacker.ID

	attackerConn := &testConn{id: attacker.ID}
	room.conns[attacker.ID] = attackerConn

	success := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: attacker.ID,
		Conn:     attackerConn,
		Data: protocol.SkillMsg{
			SkillID:  "peek",
			TargetID: defender.ID,
		},
	})

	if !success {
		t.Fatalf("expected skill handle to succeed")
	}

	// Attacker heat should be 15, skill consumed
	if attacker.Heat != 15 {
		t.Fatalf("expected attacker heat 15, got %d", attacker.Heat)
	}
	if len(attacker.Skills) != 0 {
		t.Fatalf("expected attacker skill consumed")
	}

	// Defender counter should be consumed
	if len(defender.Skills) != 0 {
		t.Fatalf("expected defender counter to be consumed, remaining: %d", len(defender.Skills))
	}

	// Attacker should NOT have peeked card
	if len(room.effects.Peeked[attacker.ID]) != 0 {
		t.Fatalf("expected no peeked cards recorded")
	}

	// Verify skill_effect message marked blocked=true
	var effectMsg protocol.SkillEffectMsg
	found := false
	for _, m := range attackerConn.messages {
		if m.msgType == "skill_effect" {
			effectMsg = m.payload.(protocol.SkillEffectMsg)
			found = true
			break
		}
	}
	if !found || !effectMsg.Blocked {
		t.Fatalf("expected skill_effect message with Blocked=true, got %+v", effectMsg)
	}
}

func TestMistSkillAltersViewOnly(t *testing.T) {
	room := NewRoom("room-mist")
	room.ticker.Stop()

	caster := newHumanPlayer("caster", 0)
	caster.Hand = []poker.Card{c(14, poker.Spades), c(13, poker.Spades)}
	caster.Skills = []skill.Card{{ID: "mist", Name: "Mist", Cost: 25}}

	target := newHumanPlayer("target", 1)
	target.Hand = []poker.Card{c(10, poker.Hearts), c(9, poker.Hearts)}

	realCommunity := []poker.Card{c(2, poker.Hearts), c(3, poker.Hearts), c(4, poker.Hearts)}
	room.state.Community = append([]poker.Card{}, realCommunity...)
	room.state.Players = []*PlayerState{caster, target}
	room.state.Phase = PhaseFlop
	room.state.CurrentPlayer = caster.ID

	conn := &testConn{id: caster.ID}
	room.conns[caster.ID] = conn

	success := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: caster.ID,
		Conn:     conn,
		Data: protocol.SkillMsg{
			SkillID: "mist",
		},
	})
	if !success {
		t.Fatalf("expected mist skill to succeed")
	}

	// Check views
	casterView := BuildGameState(room.state, room.effects, caster)
	targetView := BuildGameState(room.state, room.effects, target)

	if len(casterView.CommunityCards) != 3 || len(targetView.CommunityCards) != 3 {
		t.Fatalf("expected 3 community cards in views")
	}

	// Caster sees real community cards
	if casterView.CommunityCards[0] != "2H" || casterView.CommunityCards[1] != "3H" || casterView.CommunityCards[2] != "4H" {
		t.Fatalf("caster should see real cards, got %v", casterView.CommunityCards)
	}

	// Target sees 1 modified card
	matchCount := 0
	for i := 0; i < 3; i++ {
		if targetView.CommunityCards[i] == realCommunity[i].String() {
			matchCount++
		}
	}
	if matchCount != 2 {
		t.Fatalf("target should see exactly 2 matching and 1 fake card, got matchCount=%d (%v)", matchCount, targetView.CommunityCards)
	}
}

func TestSwapSkillReplacesCardFromDeck(t *testing.T) {
	room := NewRoom("room-swap")
	room.ticker.Stop()

	player := newHumanPlayer("p1", 0)
	player.Hand = []poker.Card{c(2, poker.Clubs), c(3, poker.Clubs)}
	player.Skills = []skill.Card{{ID: "swap", Name: "Swap", Cost: 30}}

	// Setup deck with known top card: AH
	room.state.Deck = []poker.Card{c(14, poker.Hearts), c(13, poker.Hearts)}
	room.state.Players = []*PlayerState{player}
	room.state.Phase = PhaseFlop
	room.state.CurrentPlayer = player.ID

	conn := &testConn{id: player.ID}
	room.conns[player.ID] = conn

	// Swap card index 0 (2C)
	success := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: player.ID,
		Conn:     conn,
		Data: protocol.SkillMsg{
			SkillID: "swap",
			CardIdx: 0,
		},
	})

	if !success {
		t.Fatalf("expected swap to succeed")
	}

	if player.Hand[0].String() != "AH" {
		t.Fatalf("expected Hand[0] to be AH, got %s", player.Hand[0].String())
	}
	if player.Hand[1].String() != "3C" {
		t.Fatalf("expected Hand[1] to remain 3C, got %s", player.Hand[1].String())
	}
}

func TestHeatWarningAndLockout(t *testing.T) {
	room := NewRoom("room-heat")
	room.ticker.Stop()

	player := newHumanPlayer("p1", 0)
	player.Skills = []skill.Card{
		{ID: "swap", Name: "Swap", Cost: 30},
		{ID: "swap", Name: "Swap", Cost: 30},
		{ID: "swap", Name: "Swap", Cost: 30},
	}
	opponent := newHumanPlayer("p2", 1)
	room.state.Players = []*PlayerState{player, opponent}
	room.state.Phase = PhaseFlop
	room.state.CurrentPlayer = player.ID

	// Initial heat: 0
	if player.Heat != 0 {
		t.Fatalf("expected heat 0")
	}

	// Add heat to 60 -> No warning
	player.Heat = 60
	view := BuildGameState(room.state, room.effects, opponent)
	for _, p := range view.Players {
		if p.ID == player.ID && p.HeatWarning {
			t.Fatalf("heat 60 should not trigger warning")
		}
	}

	// Add heat to 70 -> Warning visible to opponent
	player.Heat = 70
	view = BuildGameState(room.state, room.effects, opponent)
	for _, p := range view.Players {
		if p.ID == player.ID && !p.HeatWarning {
			t.Fatalf("heat 70 should trigger warning for opponent")
		}
	}

	// Add heat to 100 -> Lockout
	player.Heat = 100
	conn := &testConn{id: player.ID}
	room.conns[player.ID] = conn

	success := room.handleSkill(Event{
		Type:     "skill",
		PlayerID: player.ID,
		Conn:     conn,
		Data: protocol.SkillMsg{
			SkillID: "swap",
			CardIdx: 0,
		},
	})
	if success {
		t.Fatalf("expected skill use to fail at heat 100")
	}

	ack, ok := conn.lastAck()
	if !ok || ack.Success || ack.Error != "heat locked" {
		t.Fatalf("expected 'heat locked' error ack, got %+v", ack)
	}

	// End hand -> Heat decay by 10 (100 -> 90)
	room.endHand()
	if player.Heat != 90 {
		t.Fatalf("expected heat to decay to 90, got %d", player.Heat)
	}
}

func TestCompleteBettingRoundAndStreetProgression(t *testing.T) {
	room := NewRoom("room-streets")
	room.ticker.Stop()

	p1 := newHumanPlayer("p1", 0)
	p2 := newHumanPlayer("p2", 1)
	room.state.Players = []*PlayerState{p1, p2}
	// Initial dealer is -1, so startHand() sets DealerSeat = 0 (p1)
	room.startHand()

	if room.state.Phase != PhasePreFlop {
		t.Fatalf("expected phase PreFlop, got %s", room.state.Phase)
	}

	// In 2-player heads up: Dealer (Seat 0, P1) is SB, Seat 1 (P2) is BB.
	// SB (P1) acts first preflop to call or raise.
	if room.state.CurrentPlayer != p1.ID {
		t.Fatalf("expected current player p1, got %s", room.state.CurrentPlayer)
	}

	// P1 Calls 5 (TotalBet=10)
	err := room.applyAction(p1, protocol.ActionMsg{Action: "call"})
	if err != nil {
		t.Fatalf("p1 call failed: %v", err)
	}
	room.afterAction()

	// Now P2 (BB) has option to Check or Raise
	if room.state.CurrentPlayer != p2.ID {
		t.Fatalf("expected current player p2, got %s", room.state.CurrentPlayer)
	}

	// P2 Checks -> Preflop ends -> Moves to Flop!
	err = room.applyAction(p2, protocol.ActionMsg{Action: "check"})
	if err != nil {
		t.Fatalf("p2 check failed: %v", err)
	}
	room.afterAction()

	if room.state.Phase != PhaseFlop {
		t.Fatalf("expected phase Flop, got %s", room.state.Phase)
	}
	if len(room.state.Community) != 3 {
		t.Fatalf("expected 3 community cards, got %d", len(room.state.Community))
	}

	// Flop: First to act postflop after dealer(0) is p2 (seat 1)
	if room.state.CurrentPlayer != p2.ID {
		t.Fatalf("expected p2 to act first postflop, got %s", room.state.CurrentPlayer)
	}

	// P2 checks, P1 checks -> Turn!
	_ = room.applyAction(p2, protocol.ActionMsg{Action: "check"})
	room.afterAction()
	_ = room.applyAction(p1, protocol.ActionMsg{Action: "check"})
	room.afterAction()

	if room.state.Phase != PhaseTurn {
		t.Fatalf("expected phase Turn, got %s", room.state.Phase)
	}
	if len(room.state.Community) != 4 {
		t.Fatalf("expected 4 community cards, got %d", len(room.state.Community))
	}

	// Turn: P2 checks, P1 checks -> River!
	_ = room.applyAction(p2, protocol.ActionMsg{Action: "check"})
	room.afterAction()
	_ = room.applyAction(p1, protocol.ActionMsg{Action: "check"})
	room.afterAction()

	if room.state.Phase != PhaseRiver {
		t.Fatalf("expected phase River, got %s", room.state.Phase)
	}
	if len(room.state.Community) != 5 {
		t.Fatalf("expected 5 community cards, got %d", len(room.state.Community))
	}

	// River: P2 checks, P1 checks -> Showdown!
	_ = room.applyAction(p2, protocol.ActionMsg{Action: "check"})
	room.afterAction()
	_ = room.applyAction(p1, protocol.ActionMsg{Action: "check"})
	room.afterAction()

	if room.state.Phase != PhaseShowdown {
		t.Fatalf("expected phase Showdown, got %s", room.state.Phase)
	}
}

func TestConcurrentRoomManagerAccess(t *testing.T) {
	rm := NewRoomManager()
	var wg sync.WaitGroup

	// Concurrently create rooms, join, disconnect
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			conn := &testConn{id: fmt.Sprintf("conn-%d", idx)}
			createPayload := fmt.Sprintf(`{"name":"player-%d"}`, idx)
			rm.HandleMessage(conn, "create_room", int64(idx), []byte(createPayload))

			time.Sleep(10 * time.Millisecond)
			actionPayload := `{"action":"check"}`
			rm.HandleMessage(conn, "action", int64(idx+100), []byte(actionPayload))

			time.Sleep(10 * time.Millisecond)
			rm.Disconnect(conn)
		}(i)
	}

	wg.Wait()
}
