package game

import (
	"testing"
	"time"

	"dirtyplay-server/internal/poker"
	"dirtyplay-server/internal/skill"
)

func TestChooseBotActionRaisesWithStrongMadeHand(t *testing.T) {
	room := NewRoom("room-bot-strong")
	room.ticker.Stop()

	bot := &PlayerState{
		ID:         "bot-1",
		Name:       "bot",
		Seat:       0,
		Stack:      900,
		Status:     StatusActive,
		IsBot:      true,
		Aggression: 0.7,
		Hand: []poker.Card{
			{Rank: 14, Suit: poker.Spades},
			{Rank: 14, Suit: poker.Hearts},
		},
	}
	opp := &PlayerState{
		ID:     "human-1",
		Name:   "human",
		Seat:   1,
		Stack:  900,
		Status: StatusActive,
		Hand: []poker.Card{
			{Rank: 12, Suit: poker.Spades},
			{Rank: 11, Suit: poker.Hearts},
		},
	}

	room.state.Players = []*PlayerState{bot, opp}
	room.state.Phase = PhaseRiver
	room.state.Community = []poker.Card{
		{Rank: 14, Suit: poker.Diamonds},
		{Rank: 13, Suit: poker.Clubs},
		{Rank: 13, Suit: poker.Diamonds},
		{Rank: 7, Suit: poker.Hearts},
		{Rank: 2, Suit: poker.Spades},
	}
	room.state.CurrentBet = 0
	room.state.MinRaise = room.state.BigBlind
	room.state.CurrentPlayer = bot.ID

	action := room.chooseBotAction(bot)

	if action.Action != "raise" {
		t.Fatalf("expected strong bot hand to raise, got %#v", action)
	}
	if action.Amount <= room.state.CurrentBet {
		t.Fatalf("expected raise amount above current bet, got %#v", action)
	}
}

func TestChooseBotActionFoldsWeakHandFacingAllInPressure(t *testing.T) {
	room := NewRoom("room-bot-fold")
	room.ticker.Stop()

	bot := &PlayerState{
		ID:     "bot-1",
		Name:   "bot",
		Seat:   0,
		Stack:  80,
		Status: StatusActive,
		IsBot:  true,
		Hand: []poker.Card{
			{Rank: 7, Suit: poker.Spades},
			{Rank: 2, Suit: poker.Hearts},
		},
	}
	opp := &PlayerState{
		ID:     "human-1",
		Name:   "human",
		Seat:   1,
		Stack:  500,
		Status: StatusActive,
	}

	room.state.Players = []*PlayerState{bot, opp}
	room.state.Phase = PhasePreFlop
	room.state.CurrentBet = 80
	room.state.MinRaise = room.state.BigBlind
	room.state.CurrentPlayer = bot.ID

	action := room.chooseBotAction(bot)

	if action.Action != "fold" {
		t.Fatalf("expected weak bot hand to fold facing all-in pressure, got %#v", action)
	}
}

func TestChooseBotSkillPrefersSwapForWeakPreflopHand(t *testing.T) {
	room := NewRoom("room-bot-swap")
	room.ticker.Stop()

	bot := &PlayerState{
		ID:         "bot-1",
		Name:       "bot",
		Seat:       0,
		Stack:      initialStack,
		Status:     StatusActive,
		IsBot:      true,
		Skilliness: 0.7,
		Hand: []poker.Card{
			{Rank: 7, Suit: poker.Spades},
			{Rank: 2, Suit: poker.Hearts},
		},
		Skills: []skill.Card{
			{ID: "swap", Name: "Swap", Cost: 30},
			{ID: "bluff", Name: "Bluff", Cost: 20},
		},
	}
	opp := &PlayerState{
		ID:     "human-1",
		Name:   "human",
		Seat:   1,
		Stack:  initialStack,
		Status: StatusActive,
	}

	room.state.Players = []*PlayerState{bot, opp}
	room.state.Phase = PhasePreFlop
	room.state.CurrentPlayer = bot.ID
	room.state.Deck = []poker.Card{{Rank: 14, Suit: poker.Clubs}}

	msg, _, ok := room.chooseBotSkill(bot)
	if !ok {
		t.Fatalf("expected bot to choose a skill")
	}
	if msg.SkillID != "swap" {
		t.Fatalf("expected weak preflop hand to prefer swap, got %#v", msg)
	}
	if msg.CardIdx != 1 {
		t.Fatalf("expected bot to swap lower card index, got %#v", msg)
	}
}

func TestChooseBotSkillPeekTargetsRecentAggressor(t *testing.T) {
	room := NewRoom("room-bot-peek")
	room.ticker.Stop()

	bot := &PlayerState{
		ID:     "bot-1",
		Name:   "bot",
		Seat:   0,
		Stack:  initialStack,
		Status: StatusActive,
		IsBot:  true,
		Hand: []poker.Card{
			{Rank: 10, Suit: poker.Spades},
			{Rank: 9, Suit: poker.Spades},
		},
		Skills: []skill.Card{
			{ID: "peek", Name: "Peek", Cost: 15},
		},
	}
	aggressor := &PlayerState{
		ID:     "human-raiser",
		Name:   "raiser",
		Seat:   1,
		Stack:  initialStack,
		Status: StatusActive,
	}
	other := &PlayerState{
		ID:     "human-other",
		Name:   "other",
		Seat:   2,
		Stack:  initialStack,
		Status: StatusActive,
	}

	room.state.Players = []*PlayerState{bot, aggressor, other}
	room.state.Phase = PhaseFlop
	room.state.Community = []poker.Card{
		{Rank: 14, Suit: poker.Hearts},
		{Rank: 8, Suit: poker.Clubs},
		{Rank: 3, Suit: poker.Diamonds},
	}
	room.state.RecentActions = []ActionRecord{
		{PlayerID: aggressor.ID, Action: "raise"},
		{PlayerID: other.ID, Action: "call"},
	}

	msg, _, ok := room.chooseBotSkill(bot)
	if !ok {
		t.Fatalf("expected bot to choose peek")
	}
	if msg.SkillID != "peek" || msg.TargetID != aggressor.ID {
		t.Fatalf("expected peek to target recent aggressor, got %#v", msg)
	}
}

func TestShowdownClearsCurrentPlayerAndTimeout(t *testing.T) {
	room := NewRoom("room-showdown-clear")
	room.ticker.Stop()

	first := &PlayerState{
		ID:       "p1",
		Name:     "one",
		Seat:     0,
		Stack:    900,
		Bet:      10,
		TotalBet: 10,
		Status:   StatusActive,
		Hand: []poker.Card{
			{Rank: 14, Suit: poker.Spades},
			{Rank: 13, Suit: poker.Spades},
		},
	}
	second := &PlayerState{
		ID:       "p2",
		Name:     "two",
		Seat:     1,
		Stack:    900,
		Bet:      10,
		TotalBet: 10,
		Status:   StatusActive,
		Hand: []poker.Card{
			{Rank: 12, Suit: poker.Hearts},
			{Rank: 11, Suit: poker.Hearts},
		},
	}

	room.state.Players = []*PlayerState{first, second}
	room.state.Phase = PhaseRiver
	room.state.CurrentPlayer = first.ID
	room.state.ActionRequestedAt = time.Now()
	room.state.Community = []poker.Card{
		{Rank: 2, Suit: poker.Clubs},
		{Rank: 7, Suit: poker.Diamonds},
		{Rank: 9, Suit: poker.Hearts},
		{Rank: 10, Suit: poker.Spades},
		{Rank: 4, Suit: poker.Clubs},
	}

	room.showdown()

	if room.state.Phase != PhaseShowdown {
		t.Fatalf("expected showdown phase, got %q", room.state.Phase)
	}
	if room.state.CurrentPlayer != "" {
		t.Fatalf("expected showdown to clear current player, got %q", room.state.CurrentPlayer)
	}
	if !room.state.ActionRequestedAt.IsZero() {
		t.Fatalf("expected showdown to clear action timeout, got %v", room.state.ActionRequestedAt)
	}
	if room.state.NextHandAt.IsZero() {
		t.Fatalf("expected showdown to schedule next hand")
	}
	if room.state.LastResult == nil || room.state.LastResult.Reason != "showdown" {
		t.Fatalf("expected structured showdown result, got %#v", room.state.LastResult)
	}
	if len(room.state.LastResult.Winners) != 1 {
		t.Fatalf("expected one winner, got %#v", room.state.LastResult.Winners)
	}
	winner := room.state.LastResult.Winners[0]
	if winner.PlayerID != first.ID || winner.Amount != 20 || winner.HandCategory != 0 {
		t.Fatalf("unexpected winner result: %#v", winner)
	}
}
