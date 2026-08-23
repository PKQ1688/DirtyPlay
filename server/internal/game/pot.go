package game

import "sort"

type Pot struct {
	Amount   int
	Eligible []string
}

func CalculatePots(players []*PlayerState) []Pot {
	type contrib struct {
		id     string
		amount int
		folded bool
	}
	var contribs []contrib
	for _, p := range players {
		if p.TotalBet <= 0 {
			continue
		}
		contribs = append(contribs, contrib{
			id:     p.ID,
			amount: p.TotalBet,
			folded: p.Status == StatusFolded || p.Status == StatusOut,
		})
	}
	if len(contribs) == 0 {
		return nil
	}
	levels := make([]int, 0, len(contribs))
	levelSet := map[int]bool{}
	for _, c := range contribs {
		if !levelSet[c.amount] {
			levelSet[c.amount] = true
			levels = append(levels, c.amount)
		}
	}
	sort.Ints(levels)

	var pots []Pot
	prev := 0
	for _, level := range levels {
		if level <= prev {
			continue
		}
		playerCount := 0
		var eligible []string
		for _, c := range contribs {
			if c.amount >= level {
				playerCount++
				if !c.folded {
					eligible = append(eligible, c.id)
				}
			}
		}
		if playerCount == 0 {
			continue
		}
		amount := (level - prev) * playerCount
		pot := Pot{
			Amount:   amount,
			Eligible: eligible,
		}
		if len(pots) > 0 && sameEligiblePlayers(pots[len(pots)-1].Eligible, pot.Eligible) {
			pots[len(pots)-1].Amount += pot.Amount
		} else {
			pots = append(pots, pot)
		}
		prev = level
	}
	return pots
}

func sameEligiblePlayers(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
