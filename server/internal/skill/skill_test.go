package skill

import (
	"dirtyplay-server/internal/poker"
	"math/rand"
	"testing"
)

func TestHeatCalculations(t *testing.T) {
	// Add heat capped at 100
	heat := AddHeat(80, 30)
	if heat != MaxHeat {
		t.Fatalf("expected heat capped at %d, got %d", MaxHeat, heat)
	}

	// Normal add
	heat = AddHeat(20, 15)
	if heat != 35 {
		t.Fatalf("expected heat 35, got %d", heat)
	}

	// Decay heat
	decayed := DecayHeat(35)
	if decayed != 25 {
		t.Fatalf("expected heat 25 after decay, got %d", decayed)
	}

	// Decay floor at 0
	decayed = DecayHeat(5)
	if decayed != 0 {
		t.Fatalf("expected heat floored at 0, got %d", decayed)
	}
}

func TestSkillsLookup(t *testing.T) {
	card, ok := Find("peek")
	if !ok || card.ID != "peek" || card.Cost != 15 {
		t.Fatalf("expected peek skill card, got %+v, ok=%v", card, ok)
	}

	_, ok = Find("nonexistent")
	if ok {
		t.Fatalf("expected nonexistent skill to not be found")
	}

	rng := rand.New(rand.NewSource(42))
	randomCard := RandomCard(rng)
	if randomCard.ID == "" {
		t.Fatalf("expected valid random card, got empty")
	}
}

func TestEffectsClearing(t *testing.T) {
	effects := NewEffects()
	effects.Peeked["player1"] = []poker.Card{{Rank: 14, Suit: poker.Spades}}
	effects.Bluff["player1"] = BluffEffect{
		FakeHand: []poker.Card{{Rank: 14, Suit: poker.Hearts}, {Rank: 13, Suit: poker.Hearts}},
		Street:   "flop",
	}
	effects.Mist["player1"] = MistEffect{
		ByTarget: map[string][]poker.Card{"player2": {{Rank: 2, Suit: poker.Clubs}}},
		Street:   "flop",
	}

	// Clear street that matches
	effects.ClearStreet("flop")
	if len(effects.Bluff) != 0 || len(effects.Mist) != 0 {
		t.Fatalf("expected bluff and mist to be cleared for flop street")
	}
	if len(effects.Peeked) != 1 {
		t.Fatalf("peeked should not be cleared by street clear")
	}

	// Clear hand
	effects.ClearHand()
	if len(effects.Peeked) != 0 {
		t.Fatalf("peeked should be cleared on clear hand")
	}
}
