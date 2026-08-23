package game

import (
	"time"

	"dirtyplay-server/internal/poker"
)

type Phase string

const (
	PhaseWaiting  Phase = "waiting"
	PhaseDealing  Phase = "dealing"
	PhasePreFlop  Phase = "preflop"
	PhaseFlop     Phase = "flop"
	PhaseTurn     Phase = "turn"
	PhaseRiver    Phase = "river"
	PhaseShowdown Phase = "showdown"
)

type GameState struct {
	Phase             Phase
	Deck              []poker.Card
	Community         []poker.Card
	Players           []*PlayerState
	Pots              []Pot
	RecentActions     []ActionRecord
	ActionSeq         int64
	DealerSeat        int
	CurrentBet        int
	MinRaise          int
	CurrentPlayer     string
	SmallBlind        int
	BigBlind          int
	NextHandAt        time.Time
	HandSeq           int64
	ActionRequestedAt time.Time
	LastResult        *HandResult
}

type HandResult struct {
	Reason  string
	Winners []HandWinner
}

type HandWinner struct {
	PlayerID     string
	PlayerName   string
	Amount       int
	HandCategory int
}

type ActionRecord struct {
	Seq        int64
	HandSeq    int64
	Phase      Phase
	PlayerID   string
	PlayerName string
	Action     string
	Amount     int
	To         int
}

func (s *GameState) PlayerByID(id string) *PlayerState {
	for _, p := range s.Players {
		if p.ID == id {
			return p
		}
	}
	return nil
}

func (s *GameState) ActivePlayers() []*PlayerState {
	out := make([]*PlayerState, 0, len(s.Players))
	for _, p := range s.Players {
		if p.IsInHand() {
			out = append(out, p)
		}
	}
	return out
}

func (s *GameState) ActiveCount() int {
	count := 0
	for _, p := range s.Players {
		if p.IsInHand() {
			count++
		}
	}
	return count
}

func (s *GameState) ActingCount() int {
	count := 0
	for _, p := range s.Players {
		if p.CanAct() {
			count++
		}
	}
	return count
}
