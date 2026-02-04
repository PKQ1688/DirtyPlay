package poker

import "math/rand"

func NewDeck() []Card {
	return AllCards()
}

func Shuffle(deck []Card, rng *rand.Rand) {
	if rng == nil {
		rng = rand.New(rand.NewSource(rand.Int63()))
	}
	rng.Shuffle(len(deck), func(i, j int) {
		deck[i], deck[j] = deck[j], deck[i]
	})
}

func Draw(deck []Card) (Card, []Card) {
	if len(deck) == 0 {
		return Card{}, deck
	}
	card := deck[0]
	return card, deck[1:]
}
