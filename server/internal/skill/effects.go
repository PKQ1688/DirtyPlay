package skill

import "dirtyplay-server/internal/poker"

type Effects struct {
	Peeked map[string][]poker.Card
	Bluff  map[string]BluffEffect
	Mist   map[string]MistEffect
}

type BluffEffect struct {
	FakeHand []poker.Card
	Street   string
}

type MistEffect struct {
	ByTarget map[string][]poker.Card
	Street   string
}

func NewEffects() *Effects {
	return &Effects{
		Peeked: make(map[string][]poker.Card),
		Bluff:  make(map[string]BluffEffect),
		Mist:   make(map[string]MistEffect),
	}
}

func (e *Effects) ClearStreet(street string) {
	for id, eff := range e.Bluff {
		if eff.Street == street {
			delete(e.Bluff, id)
		}
	}
	for id, eff := range e.Mist {
		if eff.Street == street {
			delete(e.Mist, id)
		}
	}
}

func (e *Effects) ClearHand() {
	e.Peeked = make(map[string][]poker.Card)
	e.Bluff = make(map[string]BluffEffect)
	e.Mist = make(map[string]MistEffect)
}
