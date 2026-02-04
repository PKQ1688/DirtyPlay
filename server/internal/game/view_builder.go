package game

import (
	"sort"

	"dirtyplay-server/internal/poker"
	"dirtyplay-server/internal/protocol"
	"dirtyplay-server/internal/skill"
)

func BuildGameState(state *GameState, effects *skill.Effects, viewer *PlayerState) protocol.GameStateMsg {
	community := state.Community
	if state.Phase != PhaseShowdown && effects != nil {
		for _, eff := range effects.Mist {
			if eff.Street != string(state.Phase) {
				continue
			}
			if cards, ok := eff.ByTarget[viewer.ID]; ok {
				community = cards
				break
			}
		}
	}

	players := make([]protocol.PlayerInfo, 0, len(state.Players))
	for _, p := range state.Players {
		info := protocol.PlayerInfo{
			ID:       p.ID,
			Name:     p.Name,
			Seat:     p.Seat,
			Stack:    p.Stack,
			Bet:      p.Bet,
			TotalBet: p.TotalBet,
			Status:   p.Status,
		}
		if p.ID != viewer.ID && p.Heat >= skill.WarningThreshold {
			info.HeatWarning = true
		}

		if state.Phase == PhaseShowdown && p.IsInHand() {
			info.Hand = cardStrings(p.Hand)
		} else if state.Phase != PhaseShowdown && p.ID != viewer.ID && effects != nil {
			if bluff, ok := effects.Bluff[p.ID]; ok && bluff.Street == string(state.Phase) {
				info.Hand = cardStrings(bluff.FakeHand)
			}
		}
		players = append(players, info)
	}

	sort.Slice(players, func(i, j int) bool { return players[i].Seat < players[j].Seat })

	return protocol.GameStateMsg{
		Phase:          string(state.Phase),
		TotalPot:       totalPot(state),
		CommunityCards: cardStrings(community),
		MyHand:         cardStrings(viewer.Hand),
		MySkills:       toSkillInfo(viewer.Skills),
		MyHeat:         viewer.Heat,
		Players:        players,
		CurrentPlayer:  state.CurrentPlayer,
		DealerSeat:     state.DealerSeat,
	}
}

func totalPot(state *GameState) int {
	total := 0
	if len(state.Pots) > 0 {
		for _, p := range state.Pots {
			total += p.Amount
		}
		return total
	}
	for _, p := range state.Players {
		total += p.TotalBet
	}
	return total
}

func cardStrings(cards []poker.Card) []string {
	out := make([]string, 0, len(cards))
	for _, c := range cards {
		out = append(out, c.String())
	}
	return out
}

func toSkillInfo(skills []skill.Card) []protocol.SkillInfo {
	out := make([]protocol.SkillInfo, 0, len(skills))
	for _, s := range skills {
		out = append(out, protocol.SkillInfo{
			ID:   s.ID,
			Name: s.Name,
			Cost: s.Cost,
		})
	}
	return out
}
