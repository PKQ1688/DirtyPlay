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
			ID:             p.ID,
			Name:           p.Name,
			Seat:           p.Seat,
			Stack:          p.Stack,
			Bet:            p.Bet,
			TotalBet:       p.TotalBet,
			Status:         p.Status,
			LastAction:     p.LastAction,
			ActedThisRound: p.ActedThisRound,
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
	pots := displayPots(state)

	return protocol.GameStateMsg{
		Phase:          string(state.Phase),
		TotalPot:       totalPot(state),
		Pots:           toPotInfo(pots),
		CommunityCards: cardStrings(community),
		MyHand:         cardStrings(viewer.Hand),
		MySkills:       toSkillInfo(viewer.Skills),
		MyHeat:         viewer.Heat,
		Players:        players,
		CurrentPlayer:  state.CurrentPlayer,
		DealerSeat:     state.DealerSeat,
		HandSeq:        state.HandSeq,
		RecentActions:  toActionInfo(state.RecentActions),
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

func displayPots(state *GameState) []Pot {
	if len(state.Pots) > 0 {
		return state.Pots
	}
	if hasAllInCommitted(state.Players) {
		return CalculatePots(state.Players)
	}

	total := 0
	var eligible []string
	for _, p := range state.Players {
		total += p.TotalBet
		if p.TotalBet > 0 && p.Status != StatusFolded && p.Status != StatusOut {
			eligible = append(eligible, p.ID)
		}
	}
	if total <= 0 {
		return nil
	}
	return []Pot{{
		Amount:   total,
		Eligible: eligible,
	}}
}

func hasAllInCommitted(players []*PlayerState) bool {
	for _, p := range players {
		if p.Status == StatusAllIn && p.TotalBet > 0 {
			return true
		}
	}
	return false
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

func toPotInfo(pots []Pot) []protocol.PotInfo {
	out := make([]protocol.PotInfo, 0, len(pots))
	for idx, p := range pots {
		kind := "side"
		if idx == 0 {
			kind = "main"
		}
		out = append(out, protocol.PotInfo{
			Kind:          kind,
			Amount:        p.Amount,
			EligibleCount: len(p.Eligible),
		})
	}
	return out
}

func toActionInfo(actions []ActionRecord) []protocol.ActionInfo {
	out := make([]protocol.ActionInfo, 0, len(actions))
	for _, a := range actions {
		out = append(out, protocol.ActionInfo{
			Seq:        a.Seq,
			HandSeq:    a.HandSeq,
			Phase:      string(a.Phase),
			PlayerID:   a.PlayerID,
			PlayerName: a.PlayerName,
			Action:     a.Action,
			Amount:     a.Amount,
			To:         a.To,
		})
	}
	return out
}
