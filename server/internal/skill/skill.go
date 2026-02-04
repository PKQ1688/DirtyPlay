package skill

import "math/rand"

type Card struct {
	ID   string
	Name string
	Type string
	Cost int
}

const (
	TypeInfo    = "info"
	TypeDeceive = "deceive"
	TypeOperate = "operate"
	TypeDefend  = "defend"
)

var AllSkills = []Card{
	{ID: "peek", Name: "Peek", Type: TypeInfo, Cost: 15},
	{ID: "bluff", Name: "Bluff", Type: TypeDeceive, Cost: 20},
	{ID: "mist", Name: "Mist", Type: TypeDeceive, Cost: 25},
	{ID: "swap", Name: "Swap", Type: TypeOperate, Cost: 30},
	{ID: "counter", Name: "Counter", Type: TypeDefend, Cost: 5},
}

func RandomCard(rng *rand.Rand) Card {
	if rng == nil {
		rng = rand.New(rand.NewSource(rand.Int63()))
	}
	return AllSkills[rng.Intn(len(AllSkills))]
}

func Find(id string) (Card, bool) {
	for _, s := range AllSkills {
		if s.ID == id {
			return s, true
		}
	}
	return Card{}, false
}
