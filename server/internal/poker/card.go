package poker

import "fmt"

type Suit int

const (
	Spades Suit = iota
	Hearts
	Diamonds
	Clubs
)

type Card struct {
	Rank int
	Suit Suit
}

var rankNames = map[int]string{
	2:  "2",
	3:  "3",
	4:  "4",
	5:  "5",
	6:  "6",
	7:  "7",
	8:  "8",
	9:  "9",
	10: "T",
	11: "J",
	12: "Q",
	13: "K",
	14: "A",
}

var suitNames = map[Suit]string{
	Spades:   "S",
	Hearts:   "H",
	Diamonds: "D",
	Clubs:    "C",
}

func (c Card) String() string {
	return fmt.Sprintf("%s%s", rankNames[c.Rank], suitNames[c.Suit])
}

func AllCards() []Card {
	cards := make([]Card, 0, 52)
	for s := Spades; s <= Clubs; s++ {
		for r := 2; r <= 14; r++ {
			cards = append(cards, Card{Rank: r, Suit: s})
		}
	}
	return cards
}
