package poker

import (
	"testing"
)

func parseCard(s string) Card {
	r := 0
	switch s[0] {
	case '2':
		r = 2
	case '3':
		r = 3
	case '4':
		r = 4
	case '5':
		r = 5
	case '6':
		r = 6
	case '7':
		r = 7
	case '8':
		r = 8
	case '9':
		r = 9
	case 'T':
		r = 10
	case 'J':
		r = 11
	case 'Q':
		r = 12
	case 'K':
		r = 13
	case 'A':
		r = 14
	}
	suit := Spades
	switch s[1] {
	case 'S':
		suit = Spades
	case 'H':
		suit = Hearts
	case 'D':
		suit = Diamonds
	case 'C':
		suit = Clubs
	}
	return Card{Rank: r, Suit: suit}
}

func parseCards(codes ...string) []Card {
	cards := make([]Card, len(codes))
	for i, c := range codes {
		cards[i] = parseCard(c)
	}
	return cards
}

func TestEvaluator(t *testing.T) {
	tests := []struct {
		name     string
		cards    []string
		expected int // category: 0=high, 1=pair, 2=two pair, 3=three, 4=straight, 5=flush, 6=full house, 7=four, 8=straight flush
	}{
		{
			name:     "High Card",
			cards:    []string{"2S", "5H", "7D", "9C", "KH", "3D", "4S"},
			expected: 0,
		},
		{
			name:     "One Pair",
			cards:    []string{"AS", "AH", "7D", "9C", "KH", "3D", "4S"},
			expected: 1,
		},
		{
			name:     "Two Pair",
			cards:    []string{"AS", "AH", "KD", "KC", "QH", "3D", "4S"},
			expected: 2,
		},
		{
			name:     "Three of a Kind",
			cards:    []string{"AS", "AH", "AD", "KC", "QH", "3D", "4S"},
			expected: 3,
		},
		{
			name:     "Regular Straight",
			cards:    []string{"9S", "8H", "7D", "6C", "5H", "2D", "AS"},
			expected: 4,
		},
		{
			name:     "Wheel Straight (A-2-3-4-5)",
			cards:    []string{"AS", "2H", "3D", "4C", "5H", "8D", "KD"},
			expected: 4,
		},
		{
			name:     "Flush",
			cards:    []string{"2H", "5H", "7H", "9H", "KH", "3D", "AS"},
			expected: 5,
		},
		{
			name:     "Full House",
			cards:    []string{"AS", "AH", "AD", "KS", "KH", "3D", "4S"},
			expected: 6,
		},
		{
			name:     "Four of a Kind",
			cards:    []string{"AS", "AH", "AD", "AC", "KH", "3D", "4S"},
			expected: 7,
		},
		{
			name:     "Straight Flush",
			cards:    []string{"9H", "8H", "7H", "6H", "5H", "2D", "AS"},
			expected: 8,
		},
		{
			name:     "Royal Flush",
			cards:    []string{"AH", "KH", "QH", "JH", "TH", "2D", "3S"},
			expected: 8,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cards := parseCards(tc.cards...)
			rank := EvaluateBest(cards)
			if rank.Category != tc.expected {
				t.Fatalf("expected category %d, got %d", tc.expected, rank.Category)
			}
		})
	}
}

func TestHandRankComparison(t *testing.T) {
	// Higher pair beats lower pair
	pairKings := EvaluateBest(parseCards("KS", "KH", "2D", "3C", "4H"))
	pairQueens := EvaluateBest(parseCards("QS", "QH", "2D", "3C", "4H"))
	if pairKings.Compare(pairQueens) <= 0 {
		t.Fatalf("pair of Kings should beat pair of Queens")
	}

	// Same pair, higher kicker wins
	pairAceKingKicker := EvaluateBest(parseCards("AS", "AH", "KD", "3C", "4H"))
	pairAceQueenKicker := EvaluateBest(parseCards("AD", "AC", "QD", "3H", "4S"))
	if pairAceKingKicker.Compare(pairAceQueenKicker) <= 0 {
		t.Fatalf("pair with King kicker should beat pair with Queen kicker")
	}

	// Tie hand
	hand1 := EvaluateBest(parseCards("AS", "KD", "QD", "JD", "9S"))
	hand2 := EvaluateBest(parseCards("AH", "KC", "QH", "JC", "9H"))
	if hand1.Compare(hand2) != 0 {
		t.Fatalf("identical high card hands should tie, got %d", hand1.Compare(hand2))
	}
}
