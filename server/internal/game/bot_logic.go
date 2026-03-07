package game

import (
	"dirtyplay-server/internal/poker"
	"dirtyplay-server/internal/protocol"
	"dirtyplay-server/internal/skill"
)

type botDecisionContext struct {
	handStrength     float64
	madeStrength     float64
	drawStrength     float64
	pressure         float64
	position         float64
	aggression       float64
	skilliness       float64
	totalPot         int
	toCall           int
	maxRaise         int
	opponents        int
	actedOpponents   int
	pendingOpponents int
	canRaise         bool
	bluffActive      bool
}

func (r *Room) botContext(player *PlayerState) botDecisionContext {
	toCall := maxInt(0, r.state.CurrentBet-player.Bet)
	total := totalPot(r.state)
	acted, pending := r.botActionOrder(player)
	made, draw := r.botHandStrength(player)
	aggression := player.Aggression
	if aggression <= 0 {
		aggression = 0.45
	}
	skilliness := player.Skilliness
	if skilliness <= 0 {
		skilliness = 0.3
	}
	opponents := maxInt(0, r.remainingInHand()-1)
	bluffActive := false
	if eff, ok := r.effects.Bluff[player.ID]; ok && eff.Street == string(r.state.Phase) {
		bluffActive = true
	}

	position := 0.0
	if acted+pending > 0 {
		position = float64(acted) / float64(acted+pending)
	}

	return botDecisionContext{
		handStrength:     clampFloat(made+draw*0.65, 0.05, 0.99),
		madeStrength:     made,
		drawStrength:     draw,
		pressure:         float64(toCall) / float64(maxInt(1, total+toCall)),
		position:         position,
		aggression:       aggression,
		skilliness:       skilliness,
		totalPot:         total,
		toCall:           toCall,
		maxRaise:         player.Bet + player.Stack,
		opponents:        opponents,
		actedOpponents:   acted,
		pendingOpponents: pending,
		canRaise:         player.Stack > toCall && player.Stack >= toCall+r.state.MinRaise,
		bluffActive:      bluffActive,
	}
}

func (r *Room) botHandStrength(player *PlayerState) (float64, float64) {
	if len(player.Hand) == 0 {
		return 0.05, 0
	}
	if len(r.state.Community) == 0 {
		return preflopHandStrength(player.Hand), 0
	}

	cards := append([]poker.Card{}, player.Hand...)
	cards = append(cards, r.state.Community...)
	rank := poker.EvaluateBest(cards)
	return postflopHandStrength(rank), postflopDrawStrength(player.Hand, r.state.Community)
}

func preflopHandStrength(hand []poker.Card) float64 {
	if len(hand) < 2 {
		return 0.05
	}
	high := hand[0]
	low := hand[1]
	if low.Rank > high.Rank {
		high, low = low, high
	}

	if high.Rank == low.Rank {
		score := 0.58 + float64(high.Rank-2)/12*0.32
		return clampFloat(score, 0.58, 0.92)
	}

	score := 0.12
	score += float64(high.Rank-2) / 12 * 0.32
	score += float64(low.Rank-2) / 12 * 0.18
	if high.Suit == low.Suit {
		score += 0.08
	}

	gap := high.Rank - low.Rank
	switch gap {
	case 1:
		score += 0.08
	case 2:
		score += 0.04
	case 3:
		score += 0.01
	default:
		if gap >= 4 {
			score -= 0.08
		}
	}

	if high.Rank == 14 && low.Rank >= 10 {
		score += 0.06
	} else if high.Rank >= 13 && low.Rank >= 10 {
		score += 0.04
	}

	return clampFloat(score, 0.05, 0.86)
}

func postflopHandStrength(rank poker.HandRank) float64 {
	if rank.Category < 0 {
		return 0.05
	}

	baseByCategory := []float64{0.16, 0.42, 0.62, 0.74, 0.82, 0.86, 0.93, 0.97, 0.99}
	strength := baseByCategory[rank.Category]
	if len(rank.Kickers) > 0 {
		strength += float64(rank.Kickers[0]-2) / 12 * 0.06
	}
	if len(rank.Kickers) > 1 {
		strength += float64(rank.Kickers[1]-2) / 12 * 0.03
	}
	return clampFloat(strength, 0.05, 0.99)
}

func postflopDrawStrength(hand []poker.Card, community []poker.Card) float64 {
	if len(hand) == 0 || len(community) == 0 || len(community) >= 5 {
		return 0
	}

	cards := append([]poker.Card{}, hand...)
	cards = append(cards, community...)

	draw := 0.0
	suitCounts := map[poker.Suit]int{}
	for _, c := range cards {
		suitCounts[c.Suit]++
	}
	for _, count := range suitCounts {
		switch {
		case count >= 4:
			draw = maxFloat(draw, 0.22)
		case count == 3 && len(community) == 3:
			draw = maxFloat(draw, 0.08)
		}
	}

	present := make([]bool, 15)
	for _, c := range cards {
		present[c.Rank] = true
		if c.Rank == 14 {
			present[1] = true
		}
	}
	for high := 14; high >= 5; high-- {
		count := 0
		for rank := high - 4; rank <= high; rank++ {
			if present[rank] {
				count++
			}
		}
		switch {
		case count == 4:
			draw = maxFloat(draw, 0.18)
		case count == 3 && len(community) == 3:
			draw = maxFloat(draw, 0.08)
		}
	}

	boardHigh := 0
	for _, c := range community {
		if c.Rank > boardHigh {
			boardHigh = c.Rank
		}
	}
	overcards := 0
	for _, c := range hand {
		if c.Rank > boardHigh {
			overcards++
		}
	}
	if overcards == 2 {
		draw += 0.05
	}

	return clampFloat(draw, 0, 0.28)
}

func (r *Room) botActionOrder(player *PlayerState) (int, int) {
	if player == nil {
		return 0, 0
	}
	acted := 0
	pending := 0
	for _, p := range r.state.Players {
		if p.ID == player.ID || !p.CanAct() {
			continue
		}
		if p.ActedThisRound {
			acted++
		} else {
			pending++
		}
	}
	return acted, pending
}

func (r *Room) botRaiseAction(player *PlayerState, ctx botDecisionContext, scale float64) protocol.ActionMsg {
	target, ok := r.botRaiseTarget(ctx, scale)
	if !ok {
		if ctx.toCall > 0 {
			return protocol.ActionMsg{Action: "call"}
		}
		return protocol.ActionMsg{Action: "check"}
	}
	if target >= ctx.maxRaise {
		return protocol.ActionMsg{Action: "all_in"}
	}
	return protocol.ActionMsg{Action: "raise", Amount: target}
}

func (r *Room) botRaiseTarget(ctx botDecisionContext, scale float64) (int, bool) {
	if !ctx.canRaise {
		return 0, false
	}

	minTarget := r.state.CurrentBet + r.state.MinRaise
	if minTarget > ctx.maxRaise {
		return 0, false
	}

	raiseSize := maxInt(r.state.MinRaise, r.state.BigBlind*2)
	if ctx.totalPot > 0 {
		raiseSize = maxInt(raiseSize, ctx.totalPot/2)
	}
	if ctx.handStrength >= 0.82 {
		raiseSize = maxInt(raiseSize, (ctx.totalPot*2)/3)
	}
	if ctx.pendingOpponents > 1 {
		raiseSize += r.state.BigBlind
	}
	if ctx.bluffActive {
		raiseSize += r.state.BigBlind
	}

	scaled := int(float64(raiseSize) * scale * (0.9 + ctx.aggression*0.4))
	if scaled < r.state.MinRaise {
		scaled = r.state.MinRaise
	}

	target := r.state.CurrentBet + scaled
	if target < minTarget {
		target = minTarget
	}
	if target > ctx.maxRaise {
		target = ctx.maxRaise
	}
	return target, target > r.state.CurrentBet
}

func (r *Room) chooseBotSkill(player *PlayerState) (protocol.SkillMsg, float64, bool) {
	if player == nil || len(player.Skills) == 0 {
		return protocol.SkillMsg{}, 0, false
	}

	ctx := r.botContext(player)
	bestScore := 0.0
	bestMsg := protocol.SkillMsg{}
	bestPriority := 99
	found := false

	for _, card := range player.Skills {
		if card.ID == "counter" {
			continue
		}
		msg, score, ok := r.botSkillChoice(card, player, ctx)
		if !ok {
			continue
		}
		priority := botSkillPriority(card.ID)
		if !found || score > bestScore || (score == bestScore && priority < bestPriority) {
			bestScore = score
			bestMsg = msg
			bestPriority = priority
			found = true
		}
	}

	return bestMsg, bestScore, found
}

func (r *Room) botSkillChoice(card skill.Card, player *PlayerState, ctx botDecisionContext) (protocol.SkillMsg, float64, bool) {
	msg, ok := r.botSkillMsg(card, player)
	if !ok {
		return protocol.SkillMsg{}, 0, false
	}

	heatRatio := float64(player.Heat) / float64(skill.LockoutThreshold)
	multiway := float64(maxInt(0, ctx.opponents-1)) / 4
	uncertainty := 1 - ctx.handStrength
	behindFactor := 0.0
	if ctx.opponents > 0 {
		behindFactor = float64(ctx.pendingOpponents) / float64(ctx.opponents)
	}

	score := 0.0
	switch card.ID {
	case "peek":
		score = 0.24 + uncertainty*0.30 + ctx.pressure*0.18 + multiway*0.12 + behindFactor*0.08
	case "swap":
		score = 0.22 + (1-ctx.madeStrength)*0.42 + (0.12 * boolToFloat(len(r.state.Community) == 0))
		score += 0.08 * boolToFloat(ctx.handStrength < 0.35)
	case "bluff":
		score = 0.16 + uncertainty*0.24 + behindFactor*0.22 + ctx.aggression*0.12 - ctx.pressure*0.24
		if ctx.handStrength < 0.28 {
			score -= 0.15
		}
	case "mist":
		score = 0.18 + uncertainty*0.22 + multiway*0.22 + behindFactor*0.14 - ctx.position*0.08
	default:
		return protocol.SkillMsg{}, 0, false
	}

	score *= 1 - heatRatio*0.35
	return msg, clampFloat(score, 0, 0.95), true
}

func botSkillPriority(skillID string) int {
	switch skillID {
	case "swap":
		return 0
	case "peek":
		return 1
	case "mist":
		return 2
	case "bluff":
		return 3
	default:
		return 99
	}
}

func (r *Room) botPeekTarget(player *PlayerState) string {
	for i := len(r.state.RecentActions) - 1; i >= 0; i-- {
		action := r.state.RecentActions[i]
		if action.PlayerID == player.ID {
			continue
		}
		if action.Action != "raise" && action.Action != "all_in" {
			continue
		}
		target := r.state.PlayerByID(action.PlayerID)
		if target != nil && target.IsInHand() {
			return target.ID
		}
	}

	var best *PlayerState
	for _, p := range r.state.Players {
		if p.ID == player.ID || !p.IsInHand() {
			continue
		}
		if best == nil || p.TotalBet > best.TotalBet || (p.TotalBet == best.TotalBet && p.Stack > best.Stack) {
			best = p
		}
	}
	if best == nil {
		return ""
	}
	return best.ID
}

func (r *Room) botSwapIndex(player *PlayerState) int {
	if len(player.Hand) < 2 {
		return 0
	}
	if player.Hand[0].Rank == player.Hand[1].Rank {
		return 0
	}
	if player.Hand[0].Rank < player.Hand[1].Rank {
		return 0
	}
	return 1
}

func clampFloat(value float64, low float64, high float64) float64 {
	if value < low {
		return low
	}
	if value > high {
		return high
	}
	return value
}

func maxFloat(a float64, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func boolToFloat(value bool) float64 {
	if value {
		return 1
	}
	return 0
}
