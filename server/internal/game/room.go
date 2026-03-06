package game

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strconv"
	"time"

	"dirtyplay-server/internal/poker"
	"dirtyplay-server/internal/protocol"
	"dirtyplay-server/internal/skill"

	"github.com/google/uuid"
)

const (
	maxPlayers        = 6
	minPlayersToStart = 2
	targetPlayers     = 4
	initialStack      = 1000
	maxRecentActions  = 12
	actionTimeout     = 30 * time.Second
	nextHandDelay     = 3 * time.Second
	evictTimeout      = 8 * time.Second
)

type Event struct {
	Type     string
	PlayerID string
	Conn     Conn
	Data     any
	Reply    chan EventResult
}

type EventResult struct {
	PlayerID string
	Err      error
}

type Room struct {
	ID           string
	eventCh      chan Event
	ticker       *time.Ticker
	state        *GameState
	effects      *skill.Effects
	rng          *rand.Rand
	conns        map[string]Conn
	disconnected map[string]time.Time
}

func NewRoom(id string) *Room {
	return &Room{
		ID:      id,
		eventCh: make(chan Event, 64),
		ticker:  time.NewTicker(1 * time.Second),
		state: &GameState{
			Phase:      PhaseWaiting,
			DealerSeat: -1,
			SmallBlind: 5,
			BigBlind:   10,
		},
		effects:      skill.NewEffects(),
		rng:          rand.New(rand.NewSource(time.Now().UnixNano())),
		conns:        make(map[string]Conn),
		disconnected: make(map[string]time.Time),
	}
}

func (r *Room) EventLoop() {
	for {
		select {
		case evt := <-r.eventCh:
			changed := r.handleEvent(evt)
			if changed {
				r.broadcastViews()
				r.sendActionRequest()
			}
		case <-r.ticker.C:
			if r.checkTimeouts() {
				r.broadcastViews()
				r.sendActionRequest()
			}
			if r.state.Phase == PhaseShowdown && !r.state.NextHandAt.IsZero() && time.Now().After(r.state.NextHandAt) {
				r.state.NextHandAt = time.Time{}
				r.endHand()
				r.tryStartHand()
				r.broadcastViews()
				r.sendActionRequest()
			}
			if r.state.Phase == PhaseWaiting {
				if r.humanCount() > 0 && r.state.ActiveCount() >= 2 {
					r.tryStartHand()
					r.broadcastViews()
					r.sendActionRequest()
				}
			}
		}
	}
}

func (r *Room) handleEvent(evt Event) bool {
	switch evt.Type {
	case "join":
		return r.handleJoin(evt)
	case "leave":
		return r.handleLeave(evt)
	case "action":
		return r.handleAction(evt)
	case "skill":
		return r.handleSkill(evt)
	case "add_bot":
		return r.addOneBot()
	default:
		return false
	}
}

func (r *Room) handleJoin(evt Event) bool {
	join, ok := evt.Data.(protocol.JoinMsg)
	if !ok {
		r.reply(evt, "", errors.New("invalid join data"))
		return false
	}
	if join.RoomID != r.ID {
		r.reply(evt, "", errors.New("room mismatch"))
		return false
	}
	connectedHumansBeforeJoin := r.connectedHumanCount()
	playerID := join.PlayerID
	if playerID == "" {
		playerID = uuid.NewString()
	}
	player := r.state.PlayerByID(playerID)
	existingPlayer := player != nil
	if !existingPlayer && connectedHumansBeforeJoin == 0 && len(r.state.Players) > 0 {
		r.resetToEmptyRoom()
	}
	player = r.state.PlayerByID(playerID)
	if player == nil {
		if len(r.state.Players) >= maxPlayers {
			r.reply(evt, "", errors.New("room full"))
			return false
		}
		seat := r.nextSeat()
		if seat == -1 {
			r.reply(evt, "", errors.New("no seats available"))
			return false
		}
		name := join.Name
		if name == "" {
			name = "Player" + strconv.Itoa(seat+1)
		}
		player = &PlayerState{
			ID:     playerID,
			Name:   name,
			Seat:   seat,
			Stack:  initialStack,
			Status: StatusOut,
		}
		if r.state.Phase == PhaseWaiting {
			player.Status = StatusActive
		}
		r.state.Players = append(r.state.Players, player)
	} else {
		if join.Name != "" {
			player.Name = join.Name
		}
		if r.state.Phase == PhaseWaiting && player.Stack > 0 {
			player.Status = StatusActive
			player.LastAction = ""
			player.ActedThisRound = false
			player.SkillUsedThisTurn = false
		}
	}
	r.conns[playerID] = evt.Conn
	delete(r.disconnected, playerID)
	player.DisconnectedAt = time.Time{}

	if !existingPlayer && connectedHumansBeforeJoin == 0 && r.connectedHumanCount() == 1 && len(r.state.Players) == 1 {
		r.resetForFreshSession(playerID)
	}

	r.reply(evt, playerID, nil)
	return true
}

func (r *Room) handleLeave(evt Event) bool {
	if evt.PlayerID == "" {
		return false
	}
	delete(r.conns, evt.PlayerID)
	now := time.Now()
	r.disconnected[evt.PlayerID] = now
	player := r.state.PlayerByID(evt.PlayerID)
	if player == nil {
		if r.connectedHumanCount() == 0 {
			r.resetToEmptyRoom()
			return true
		}
		return false
	}

	player.DisconnectedAt = now
	if r.state.Phase == PhaseWaiting {
		player.Status = StatusOut
		changed := r.pruneDisconnectedPlayers(now)
		if r.connectedHumanCount() == 0 {
			r.resetToEmptyRoom()
			return true
		}
		return changed
	}

	if player.IsInHand() {
		if evt.PlayerID == r.state.CurrentPlayer && r.state.ActionRequestedAt.IsZero() {
			r.state.ActionRequestedAt = now
		}
	}
	return false
}

func (r *Room) handleAction(evt Event) bool {
	action, ok := evt.Data.(protocol.ActionMsg)
	if !ok {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid action"})
		return false
	}
	if r.state.Phase == PhaseWaiting || r.state.Phase == PhaseShowdown {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "not in action phase"})
		return false
	}
	if evt.PlayerID != r.state.CurrentPlayer {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "not your turn"})
		return false
	}
	player := r.state.PlayerByID(evt.PlayerID)
	if player == nil || !player.CanAct() {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid player"})
		return false
	}
	err := r.applyAction(player, action)
	if err != nil {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: err.Error()})
		return false
	}
	player.SkillUsedThisTurn = false
	_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: true})
	r.afterAction()
	return true
}

func (r *Room) handleSkill(evt Event) bool {
	skillMsg, ok := evt.Data.(protocol.SkillMsg)
	if !ok {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid skill"})
		return false
	}
	if r.state.Phase == PhaseWaiting || r.state.Phase == PhaseShowdown {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "not in action phase"})
		return false
	}
	if evt.PlayerID != r.state.CurrentPlayer {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "not your turn"})
		return false
	}
	player := r.state.PlayerByID(evt.PlayerID)
	if player == nil || !player.CanAct() {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid player"})
		return false
	}
	if player.SkillUsedThisTurn {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "skill already used"})
		return false
	}
	if player.Heat >= skill.LockoutThreshold {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "heat locked"})
		return false
	}

	card, found := r.findPlayerSkill(player, skillMsg.SkillID)
	if !found {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "skill not owned"})
		return false
	}
	if card.ID == "counter" {
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "counter is passive"})
		return false
	}

	var target *PlayerState
	switch card.ID {
	case "peek":
		target = r.state.PlayerByID(skillMsg.TargetID)
		if target == nil || !target.IsInHand() {
			_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid target"})
			return false
		}
	case "mist":
		if len(r.state.Community) == 0 {
			_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "no community cards"})
			return false
		}
	case "swap":
		if skillMsg.CardIdx < 0 || skillMsg.CardIdx >= len(player.Hand) {
			_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "invalid card index"})
			return false
		}
		if len(r.state.Deck) == 0 {
			_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "deck empty"})
			return false
		}
	}

	player.RemoveSkill(card.ID)
	player.SkillUsedThisTurn = true
	player.Heat = skill.AddHeat(player.Heat, card.Cost)

	blocked := false
	var result any
	switch card.ID {
	case "peek":
		if r.consumeCounter(target) {
			blocked = true
		} else if len(target.Hand) > 0 {
			cardIdx := r.rng.Intn(len(target.Hand))
			peeked := target.Hand[cardIdx]
			r.effects.Peeked[player.ID] = append(r.effects.Peeked[player.ID], peeked)
			result = map[string]string{"card": peeked.String()}
		}
	case "bluff":
		fakeHand := r.randomHand()
		r.effects.Bluff[player.ID] = skill.BluffEffect{
			FakeHand: fakeHand,
			Street:   string(r.state.Phase),
		}
	case "mist":
		targets := make(map[string][]poker.Card)
		for _, p := range r.state.Players {
			if p.ID == player.ID || !p.IsInHand() {
				continue
			}
			targets[p.ID] = r.mistCommunity()
		}
		r.effects.Mist[player.ID] = skill.MistEffect{
			ByTarget: targets,
			Street:   string(r.state.Phase),
		}
	case "swap":
		drawn, deck := poker.Draw(r.state.Deck)
		player.Hand[skillMsg.CardIdx] = drawn
		r.state.Deck = deck
		result = map[string]string{"card": drawn.String()}
	default:
		_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: false, Error: "unknown skill"})
		return false
	}

	_ = evt.Conn.SendMessage("skill_effect", protocol.SkillEffectMsg{
		SkillID:  card.ID,
		UserID:   player.ID,
		TargetID: skillMsg.TargetID,
		Result:   result,
		Blocked:  blocked,
	})
	_ = evt.Conn.SendMessage("ack", protocol.AckMsg{Success: true})
	return true
}

func (r *Room) reply(evt Event, playerID string, err error) {
	if evt.Reply == nil {
		return
	}
	evt.Reply <- EventResult{PlayerID: playerID, Err: err}
}

func (r *Room) broadcastViews() {
	for _, p := range r.state.Players {
		conn, ok := r.conns[p.ID]
		if !ok {
			continue
		}
		view := BuildGameState(r.state, r.effects, p)
		_ = conn.SendMessage("state", view)
	}
}

func (r *Room) sendActionRequest() {
	for {
		if r.state.Phase != PhasePreFlop && r.state.Phase != PhaseFlop && r.state.Phase != PhaseTurn && r.state.Phase != PhaseRiver {
			return
		}
		player := r.state.PlayerByID(r.state.CurrentPlayer)
		if player == nil || !player.CanAct() {
			return
		}
		if player.IsBot {
			if !r.botAct(player) {
				return
			}
			r.broadcastViews()
			continue
		}
		conn, ok := r.conns[player.ID]
		if !ok {
			r.state.ActionRequestedAt = time.Now()
			return
		}
		toCall := r.state.CurrentBet - player.Bet
		minRaise := r.state.MinRaise
		valid := validActions(player, toCall, minRaise)
		canUseSkill := player.Heat < skill.LockoutThreshold && len(player.Skills) > 0 && !player.SkillUsedThisTurn
		_ = conn.SendMessage("action_req", protocol.ActionRequestMsg{
			PlayerID:     player.ID,
			ValidActions: valid,
			ToCall:       toCall,
			MinRaise:     minRaise,
			MaxRaise:     player.Bet + player.Stack,
			CanUseSkill:  canUseSkill,
			TimeoutSec:   int(actionTimeout.Seconds()),
		})
		r.state.ActionRequestedAt = time.Now()
		return
	}
}

func validActions(p *PlayerState, toCall int, minRaise int) []string {
	var actions []string
	actions = append(actions, "fold")
	if toCall > 0 {
		actions = append(actions, "call")
	} else {
		actions = append(actions, "check")
	}
	if p.Stack > 0 {
		actions = append(actions, "all_in")
	}
	if !p.ActedThisRound && p.Stack > toCall && p.Stack >= toCall+minRaise {
		actions = append(actions, "raise")
	}
	return actions
}

func (r *Room) afterAction() {
	if r.remainingInHand() <= 1 {
		r.finishHandByFold()
		return
	}
	if r.state.ActingCount() == 0 {
		r.dealRemainingToShowdown()
		return
	}
	if r.isBettingRoundOver() {
		r.advancePhase()
		return
	}
	r.advanceToNextPlayer()
}

func (r *Room) advancePhase() {
	r.effects.ClearStreet(string(r.state.Phase))
	switch r.state.Phase {
	case PhasePreFlop:
		r.dealCommunity(3)
		r.state.Phase = PhaseFlop
	case PhaseFlop:
		r.dealCommunity(1)
		r.state.Phase = PhaseTurn
	case PhaseTurn:
		r.dealCommunity(1)
		r.state.Phase = PhaseRiver
	case PhaseRiver:
		r.showdown()
		return
	default:
		return
	}
	r.drawStreetSkills()
	r.resetBetsForStreet()
	if r.state.ActingCount() == 0 {
		r.dealRemainingToShowdown()
		return
	}
	r.state.CurrentPlayer = r.firstToActPostflop()
}

func (r *Room) resetBetsForStreet() {
	for _, p := range r.state.Players {
		if p.IsInHand() {
			p.Bet = 0
			p.ActedThisRound = false
			p.SkillUsedThisTurn = false
		}
	}
	r.state.CurrentBet = 0
	r.state.MinRaise = r.state.BigBlind
}

func (r *Room) advanceToNextPlayer() {
	current := r.state.PlayerByID(r.state.CurrentPlayer)
	startSeat := -1
	if current != nil {
		startSeat = current.Seat
	}
	next := r.nextToActAfter(startSeat)
	if next == nil {
		r.showdown()
		return
	}
	r.state.CurrentPlayer = next.ID
}

func (r *Room) isBettingRoundOver() bool {
	for _, p := range r.state.Players {
		if !p.CanAct() {
			continue
		}
		if !p.ActedThisRound {
			return false
		}
		if p.Bet != r.state.CurrentBet {
			return false
		}
	}
	return true
}

func (r *Room) remainingInHand() int {
	count := 0
	for _, p := range r.state.Players {
		if p.IsInHand() {
			count++
		}
	}
	return count
}

func (r *Room) finishHandByFold() {
	var winner *PlayerState
	for _, p := range r.state.Players {
		if p.IsInHand() {
			winner = p
			break
		}
	}
	if winner != nil {
		total := 0
		for _, p := range r.state.Players {
			total += p.TotalBet
		}
		winner.Stack += total
	}
	r.endHand()
}

func (r *Room) showdown() {
	r.state.Phase = PhaseShowdown
	r.effects.ClearHand()
	r.state.Pots = CalculatePots(r.state.Players)
	if len(r.state.Pots) == 0 {
		r.endHand()
		return
	}

	rankMap := map[string]poker.HandRank{}
	for _, p := range r.state.Players {
		if !p.IsInHand() {
			continue
		}
		cards := append([]poker.Card{}, p.Hand...)
		cards = append(cards, r.state.Community...)
		rankMap[p.ID] = poker.EvaluateBest(cards)
	}

	for _, pot := range r.state.Pots {
		if len(pot.Eligible) == 0 {
			continue
		}
		var winners []string
		var best poker.HandRank
		first := true
		for _, id := range pot.Eligible {
			rank, ok := rankMap[id]
			if !ok {
				continue
			}
			if first || rank.Compare(best) > 0 {
				best = rank
				winners = []string{id}
				first = false
			} else if rank.Compare(best) == 0 {
				winners = append(winners, id)
			}
		}
		if len(winners) == 0 {
			continue
		}
		share := pot.Amount / len(winners)
		remainder := pot.Amount % len(winners)
		order := r.orderBySeat(winners)
		for i, id := range order {
			player := r.state.PlayerByID(id)
			if player == nil {
				continue
			}
			add := share
			if i < remainder {
				add++
			}
			player.Stack += add
		}
	}
	r.state.NextHandAt = time.Now().Add(nextHandDelay)
}

func (r *Room) dealRemainingToShowdown() {
	for len(r.state.Community) < 5 {
		r.dealCommunity(1)
	}
	r.showdown()
}

func (r *Room) endHand() {
	for _, p := range r.state.Players {
		p.Heat = skill.DecayHeat(p.Heat)
		p.Bet = 0
		p.TotalBet = 0
		p.LastAction = ""
		p.Hand = nil
		p.ActedThisRound = false
		p.SkillUsedThisTurn = false
		if p.Stack <= 0 {
			p.Status = StatusOut
		} else {
			p.Status = StatusActive
		}
	}
	kept := make([]*PlayerState, 0, len(r.state.Players))
	for _, p := range r.state.Players {
		if p.IsBot {
			kept = append(kept, p)
			continue
		}
		if _, ok := r.conns[p.ID]; ok {
			p.DisconnectedAt = time.Time{}
			kept = append(kept, p)
			continue
		}
		if !p.DisconnectedAt.IsZero() && p.Stack > 0 {
			p.Status = StatusOut
			kept = append(kept, p)
			continue
		}
		delete(r.disconnected, p.ID)
	}
	r.state.Players = kept

	r.state.Pots = nil
	r.state.Community = nil
	r.state.CurrentBet = 0
	r.state.MinRaise = r.state.BigBlind
	r.state.CurrentPlayer = ""
	r.state.Phase = PhaseWaiting
	r.effects.ClearHand()

	if r.humanCount() == 0 && r.connectedHumanCount() == 0 {
		r.resetToEmptyRoom()
	}
}

func (r *Room) tryStartHand() {
	if r.state.ActiveCount() < 2 {
		return
	}
	r.startHand()
}

func (r *Room) startHand() {
	r.state.HandSeq++
	r.state.Phase = PhaseDealing
	r.state.Community = nil
	r.state.Pots = nil
	r.state.RecentActions = nil
	r.effects.ClearHand()

	r.state.Deck = poker.NewDeck()
	poker.Shuffle(r.state.Deck, r.rng)

	eligible := r.eligiblePlayers()
	if len(eligible) < 2 {
		r.state.Phase = PhaseWaiting
		return
	}

	r.rotateDealer(eligible)

	for _, p := range r.state.Players {
		if p.Stack <= 0 {
			p.Status = StatusOut
			p.LastAction = ""
			continue
		}
		p.ResetForHand()
	}

	for i := 0; i < 2; i++ {
		for _, p := range eligible {
			card, deck := poker.Draw(r.state.Deck)
			r.state.Deck = deck
			p.Hand = append(p.Hand, card)
		}
	}
	for _, p := range eligible {
		r.drawSkill(p, 1)
	}

	var sb *PlayerState
	var bb *PlayerState
	if len(eligible) == 2 {
		sb = r.playerBySeat(r.state.DealerSeat)
		if sb != nil {
			bb = r.nextInHandAfter(sb.Seat)
		}
	} else {
		sb = r.nextInHandAfter(r.state.DealerSeat)
		if sb != nil {
			bb = r.nextInHandAfter(sb.Seat)
		}
	}
	if sb == nil || bb == nil {
		r.state.Phase = PhaseWaiting
		return
	}
	r.postBlind(sb, r.state.SmallBlind)
	r.postBlind(bb, r.state.BigBlind)

	r.state.CurrentBet = bb.Bet
	r.state.MinRaise = r.state.BigBlind
	r.state.Phase = PhasePreFlop
	next := r.nextToActAfter(bb.Seat)
	if next != nil {
		r.state.CurrentPlayer = next.ID
	}
}

func (r *Room) postBlind(p *PlayerState, blind int) {
	if p == nil || blind <= 0 {
		return
	}
	amount := blind
	if amount > p.Stack {
		amount = p.Stack
	}
	p.Stack -= amount
	p.Bet += amount
	p.TotalBet += amount
	p.LastAction = "blind"
	if p.Stack == 0 {
		p.Status = StatusAllIn
	}
	action := "blind"
	if blind == r.state.SmallBlind {
		action = "blind_sb"
	} else if blind == r.state.BigBlind {
		action = "blind_bb"
	}
	r.appendActionRecord(p, action, amount, p.Bet)
}

func (r *Room) applyAction(p *PlayerState, action protocol.ActionMsg) error {
	toCall := r.state.CurrentBet - p.Bet
	switch action.Action {
	case "fold":
		p.Status = StatusFolded
		p.ActedThisRound = true
		p.LastAction = "fold"
		r.appendActionRecord(p, "fold", 0, p.Bet)
		return nil
	case "check":
		if toCall != 0 {
			return errors.New("cannot check")
		}
		p.ActedThisRound = true
		p.LastAction = "check"
		r.appendActionRecord(p, "check", 0, p.Bet)
		return nil
	case "call":
		if toCall <= 0 {
			return errors.New("nothing to call")
		}
		pay := minInt(toCall, p.Stack)
		if err := r.commitBet(p, pay); err != nil {
			return err
		}
		p.ActedThisRound = true
		p.LastAction = "call"
		r.appendActionRecord(p, "call", pay, p.Bet)
		return nil
	case "raise":
		if action.Amount <= r.state.CurrentBet {
			return errors.New("raise too small")
		}
		raiseAmt := action.Amount - r.state.CurrentBet
		if raiseAmt < r.state.MinRaise {
			return errors.New("raise below min")
		}
		needed := action.Amount - p.Bet
		if needed > p.Stack {
			return errors.New("insufficient stack")
		}
		if err := r.commitBet(p, needed); err != nil {
			return err
		}
		r.state.CurrentBet = action.Amount
		r.state.MinRaise = raiseAmt
		r.resetActedExcept(p.ID)
		p.ActedThisRound = true
		p.LastAction = "raise"
		r.appendActionRecord(p, "raise", needed, action.Amount)
		return nil
	case "all_in":
		if p.Stack <= 0 {
			return errors.New("no chips")
		}
		allin := p.Stack
		if err := r.commitBet(p, allin); err != nil {
			return err
		}
		if p.Bet > r.state.CurrentBet {
			raiseAmt := p.Bet - r.state.CurrentBet
			r.state.CurrentBet = p.Bet
			if raiseAmt >= r.state.MinRaise {
				r.state.MinRaise = raiseAmt
				r.resetActedExcept(p.ID)
			}
		}
		p.ActedThisRound = true
		p.LastAction = "all_in"
		r.appendActionRecord(p, "all_in", allin, p.Bet)
		return nil
	default:
		return errors.New("unknown action")
	}
}

func (r *Room) commitBet(p *PlayerState, amount int) error {
	if amount < 0 {
		return errors.New("invalid bet")
	}
	if amount > p.Stack {
		return errors.New("insufficient stack")
	}
	p.Stack -= amount
	p.Bet += amount
	p.TotalBet += amount
	if p.Stack == 0 {
		p.Status = StatusAllIn
	}
	return nil
}

func (r *Room) resetActedExcept(playerID string) {
	for _, p := range r.state.Players {
		if p.ID == playerID {
			continue
		}
		if p.CanAct() {
			p.ActedThisRound = false
		}
	}
}

func (r *Room) drawStreetSkills() {
	for _, p := range r.state.Players {
		if !p.IsInHand() {
			continue
		}
		if len(p.Skills) >= 3 {
			continue
		}
		if r.rng.Float64() <= 0.30 {
			r.drawSkill(p, 1)
		}
	}
}

func (r *Room) drawSkill(p *PlayerState, count int) {
	for i := 0; i < count && len(p.Skills) < 3; i++ {
		p.Skills = append(p.Skills, skill.RandomCard(r.rng))
	}
}

func (r *Room) dealCommunity(n int) {
	for i := 0; i < n; i++ {
		card, deck := poker.Draw(r.state.Deck)
		r.state.Deck = deck
		r.state.Community = append(r.state.Community, card)
	}
}

func (r *Room) checkTimeouts() bool {
	changed := false
	currentFolded := false
	now := time.Now()
	for id, since := range r.disconnected {
		if now.Sub(since) < actionTimeout {
			continue
		}
		player := r.state.PlayerByID(id)
		if player != nil && player.CanAct() {
			player.Status = StatusFolded
			player.LastAction = "fold"
			r.appendActionRecord(player, "fold", 0, player.Bet)
			changed = true
			if id == r.state.CurrentPlayer {
				currentFolded = true
			}
		}
		delete(r.disconnected, id)
	}

	// Timeout for connected players who haven't acted
	if !r.state.ActionRequestedAt.IsZero() && r.state.CurrentPlayer != "" {
		player := r.state.PlayerByID(r.state.CurrentPlayer)
		if player != nil && player.CanAct() && !player.IsBot {
			if now.Sub(r.state.ActionRequestedAt) >= actionTimeout {
				toCall := r.state.CurrentBet - player.Bet
				if toCall <= 0 {
					_ = r.applyAction(player, protocol.ActionMsg{Action: "check"})
				} else {
					_ = r.applyAction(player, protocol.ActionMsg{Action: "fold"})
				}
				player.SkillUsedThisTurn = false
				r.state.ActionRequestedAt = time.Time{}
				r.afterAction()
				return true
			}
		}
	}

	if changed {
		if r.remainingInHand() <= 1 {
			r.finishHandByFold()
			return true
		}
		if currentFolded {
			r.afterAction()
		}
	}
	if r.pruneDisconnectedPlayers(now) {
		return true
	}
	return changed
}

func (r *Room) nextSeat() int {
	occupied := map[int]bool{}
	for _, p := range r.state.Players {
		occupied[p.Seat] = true
	}
	for i := 0; i < maxPlayers; i++ {
		if !occupied[i] {
			return i
		}
	}
	return -1
}

func (r *Room) eligiblePlayers() []*PlayerState {
	var players []*PlayerState
	for _, p := range r.state.Players {
		if p.Stack > 0 {
			players = append(players, p)
		}
	}
	sort.Slice(players, func(i, j int) bool { return players[i].Seat < players[j].Seat })
	return players
}

func (r *Room) rotateDealer(eligible []*PlayerState) {
	if len(eligible) == 0 {
		return
	}
	if r.state.DealerSeat == -1 {
		r.state.DealerSeat = eligible[0].Seat
		return
	}
	for _, p := range eligible {
		if p.Seat > r.state.DealerSeat {
			r.state.DealerSeat = p.Seat
			return
		}
	}
	r.state.DealerSeat = eligible[0].Seat
}

func (r *Room) nextInHandAfter(seat int) *PlayerState {
	players := r.orderedPlayers()
	for _, p := range players {
		if p.Seat > seat && p.IsInHand() {
			return p
		}
	}
	for _, p := range players {
		if p.Seat <= seat && p.IsInHand() {
			return p
		}
	}
	return nil
}

func (r *Room) nextToActAfter(seat int) *PlayerState {
	players := r.orderedPlayers()
	for _, p := range players {
		if p.Seat > seat && p.CanAct() {
			return p
		}
	}
	for _, p := range players {
		if p.Seat <= seat && p.CanAct() {
			return p
		}
	}
	return nil
}

func (r *Room) firstToActPostflop() string {
	player := r.nextToActAfter(r.state.DealerSeat)
	if player == nil {
		return ""
	}
	return player.ID
}

func (r *Room) orderedPlayers() []*PlayerState {
	players := make([]*PlayerState, 0, len(r.state.Players))
	players = append(players, r.state.Players...)
	sort.Slice(players, func(i, j int) bool { return players[i].Seat < players[j].Seat })
	return players
}

func (r *Room) orderBySeat(ids []string) []string {
	seatOf := map[string]int{}
	for _, p := range r.state.Players {
		seatOf[p.ID] = p.Seat
	}
	sort.Slice(ids, func(i, j int) bool {
		return seatOf[ids[i]] < seatOf[ids[j]]
	})
	if r.state.DealerSeat == -1 {
		return ids
	}
	ordered := make([]string, 0, len(ids))
	start := r.state.DealerSeat
	for offset := 1; offset <= maxPlayers; offset++ {
		seat := (start + offset) % maxPlayers
		for _, id := range ids {
			if seatOf[id] == seat {
				ordered = append(ordered, id)
			}
		}
	}
	if len(ordered) == len(ids) {
		return ordered
	}
	return ids
}

func (r *Room) playerBySeat(seat int) *PlayerState {
	for _, p := range r.state.Players {
		if p.Seat == seat {
			return p
		}
	}
	return nil
}

func (r *Room) consumeCounter(target *PlayerState) bool {
	for i, s := range target.Skills {
		if s.ID == "counter" {
			target.Skills = append(target.Skills[:i], target.Skills[i+1:]...)
			target.Heat = skill.AddHeat(target.Heat, s.Cost)
			return true
		}
	}
	return false
}

func (r *Room) findPlayerSkill(player *PlayerState, skillID string) (skill.Card, bool) {
	for _, s := range player.Skills {
		if s.ID == skillID {
			return s, true
		}
	}
	return skill.Card{}, false
}

func (r *Room) randomHand() []poker.Card {
	known := r.knownCards()
	cards := make([]poker.Card, 0, 2)
	for len(cards) < 2 {
		card := r.randomCardExcluding(known)
		known[card.String()] = true
		cards = append(cards, card)
	}
	return cards
}

func (r *Room) mistCommunity() []poker.Card {
	community := append([]poker.Card{}, r.state.Community...)
	if len(community) == 0 {
		return community
	}
	known := r.knownCards()
	idx := r.rng.Intn(len(community))
	card := r.randomCardExcluding(known)
	community[idx] = card
	return community
}

func (r *Room) knownCards() map[string]bool {
	known := map[string]bool{}
	for _, c := range r.state.Community {
		known[c.String()] = true
	}
	for _, p := range r.state.Players {
		for _, c := range p.Hand {
			known[c.String()] = true
		}
	}
	return known
}

func (r *Room) randomCardExcluding(known map[string]bool) poker.Card {
	all := poker.AllCards()
	for {
		card := all[r.rng.Intn(len(all))]
		if !known[card.String()] {
			return card
		}
	}
}

func (r *Room) appendActionRecord(player *PlayerState, action string, amount int, to int) {
	if player == nil {
		return
	}
	r.state.ActionSeq++
	r.state.RecentActions = append(r.state.RecentActions, ActionRecord{
		Seq:        r.state.ActionSeq,
		HandSeq:    r.state.HandSeq,
		Phase:      r.state.Phase,
		PlayerID:   player.ID,
		PlayerName: player.Name,
		Action:     action,
		Amount:     amount,
		To:         to,
	})
	if len(r.state.RecentActions) <= maxRecentActions {
		return
	}
	r.state.RecentActions = append([]ActionRecord{}, r.state.RecentActions[len(r.state.RecentActions)-maxRecentActions:]...)
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (r *Room) addOneBot() bool {
	if r.humanCount() == 0 {
		return false
	}
	if len(r.state.Players) >= maxPlayers {
		return false
	}
	seat := r.nextSeat()
	if seat == -1 {
		return false
	}
	aggro := 0.25 + r.rng.Float64()*0.6
	skilliness := 0.2 + r.rng.Float64()*0.6
	bot := &PlayerState{
		ID:         "bot-" + uuid.NewString(),
		Name:       fmt.Sprintf("Bot%d", seat+1),
		Seat:       seat,
		Stack:      initialStack,
		Status:     StatusActive,
		IsBot:      true,
		Aggression: aggro,
		Skilliness: skilliness,
	}
	r.state.Players = append(r.state.Players, bot)
	return true
}

func (r *Room) ensureBots(target int) bool {
	if target <= 0 {
		return false
	}
	if r.humanCount() == 0 {
		return false
	}
	if target > maxPlayers {
		target = maxPlayers
	}
	total := 0
	for _, p := range r.state.Players {
		if p.Stack > 0 {
			total++
		}
	}
	changed := false
	for total < target && len(r.state.Players) < maxPlayers {
		seat := r.nextSeat()
		if seat == -1 {
			break
		}
		aggro := 0.25 + r.rng.Float64()*0.6
		skilliness := 0.2 + r.rng.Float64()*0.6
		bot := &PlayerState{
			ID:         "bot-" + uuid.NewString(),
			Name:       fmt.Sprintf("Bot%d", seat+1),
			Seat:       seat,
			Stack:      initialStack,
			Status:     StatusActive,
			IsBot:      true,
			Aggression: aggro,
			Skilliness: skilliness,
		}
		r.state.Players = append(r.state.Players, bot)
		total++
		changed = true
	}
	return changed
}

func (r *Room) humanCount() int {
	count := 0
	for _, p := range r.state.Players {
		if p.Stack > 0 && !p.IsBot {
			count++
		}
	}
	return count
}

func (r *Room) connectedHumanCount() int {
	count := 0
	for _, p := range r.state.Players {
		if p.IsBot {
			continue
		}
		if _, ok := r.conns[p.ID]; ok {
			count++
		}
	}
	return count
}

func (r *Room) resetForFreshSession(playerID string) {
	player := r.state.PlayerByID(playerID)
	if player == nil {
		return
	}
	player.Seat = 0
	player.Stack = initialStack
	player.Bet = 0
	player.TotalBet = 0
	player.LastAction = ""
	player.Status = StatusActive
	player.IsBot = false
	player.Aggression = 0
	player.Skilliness = 0
	player.Hand = nil
	player.Skills = nil
	player.Heat = 0
	player.ActedThisRound = false
	player.SkillUsedThisTurn = false
	player.DisconnectedAt = time.Time{}

	keepConn := r.conns[playerID]
	r.state.Players = []*PlayerState{player}
	r.conns = map[string]Conn{playerID: keepConn}
	r.disconnected = map[string]time.Time{}

	r.state.Deck = nil
	r.state.Community = nil
	r.state.Pots = nil
	r.state.RecentActions = nil
	r.state.ActionSeq = 0
	r.state.CurrentPlayer = ""
	r.state.CurrentBet = 0
	r.state.MinRaise = r.state.BigBlind
	r.state.DealerSeat = -1
	r.state.Phase = PhaseWaiting
	r.state.NextHandAt = time.Time{}
	r.effects.ClearHand()
}

func (r *Room) resetToEmptyRoom() {
	r.state.Players = nil
	r.state.Deck = nil
	r.state.Community = nil
	r.state.Pots = nil
	r.state.RecentActions = nil
	r.state.ActionSeq = 0
	r.state.CurrentPlayer = ""
	r.state.CurrentBet = 0
	r.state.MinRaise = r.state.BigBlind
	r.state.DealerSeat = -1
	r.state.Phase = PhaseWaiting
	r.state.NextHandAt = time.Time{}
	r.effects.ClearHand()
	r.conns = map[string]Conn{}
	r.disconnected = map[string]time.Time{}
}

func (r *Room) pruneDisconnectedPlayers(now time.Time) bool {
	if r.state.Phase != PhaseWaiting {
		return false
	}
	changed := false
	kept := make([]*PlayerState, 0, len(r.state.Players))
	for _, p := range r.state.Players {
		if p.DisconnectedAt.IsZero() {
			kept = append(kept, p)
			continue
		}
		if _, connected := r.conns[p.ID]; connected {
			p.DisconnectedAt = time.Time{}
			kept = append(kept, p)
			continue
		}
		if now.Sub(p.DisconnectedAt) < evictTimeout {
			kept = append(kept, p)
			continue
		}
		changed = true
	}
	if !changed {
		return false
	}
	r.state.Players = kept
	if r.state.PlayerByID(r.state.CurrentPlayer) == nil {
		r.state.CurrentPlayer = ""
	}
	if r.playerBySeat(r.state.DealerSeat) == nil {
		r.state.DealerSeat = -1
	}
	if r.humanCount() == 0 && r.connectedHumanCount() == 0 {
		r.resetToEmptyRoom()
	}
	return true
}

func (r *Room) botAct(player *PlayerState) bool {
	if player == nil || !player.CanAct() {
		return false
	}
	if r.state.Phase != PhasePreFlop && r.state.Phase != PhaseFlop && r.state.Phase != PhaseTurn && r.state.Phase != PhaseRiver {
		return false
	}
	r.botMaybeUseSkill(player)
	action := r.chooseBotAction(player)
	if err := r.applyAction(player, action); err != nil {
		action = r.fallbackBotAction(player)
		if err := r.applyAction(player, action); err != nil {
			if err2 := r.applyAction(player, protocol.ActionMsg{Action: "fold"}); err2 != nil {
				// All actions failed — force fold to prevent infinite loop
				player.Status = StatusFolded
				player.ActedThisRound = true
				player.LastAction = "fold"
				r.appendActionRecord(player, "fold", 0, player.Bet)
			}
		}
	}
	player.SkillUsedThisTurn = false
	r.afterAction()
	return true
}

func (r *Room) chooseBotAction(player *PlayerState) protocol.ActionMsg {
	toCall := r.state.CurrentBet - player.Bet
	canRaise := player.Stack > toCall && player.Stack >= toCall+r.state.MinRaise
	maxRaise := player.Bet + player.Stack
	if toCall <= 0 {
		if canRaise && r.rng.Float64() < 0.22 {
			amount := r.state.CurrentBet + r.state.MinRaise
			if amount > maxRaise {
				amount = maxRaise
			}
			return protocol.ActionMsg{Action: "raise", Amount: amount}
		}
		return protocol.ActionMsg{Action: "check"}
	}

	if toCall >= player.Stack {
		return protocol.ActionMsg{Action: "all_in"}
	}

	callLimit := maxInt(r.state.BigBlind*3, player.Stack/6)
	if toCall <= callLimit {
		if canRaise && r.rng.Float64() < 0.15 {
			amount := r.state.CurrentBet + r.state.MinRaise
			if amount > maxRaise {
				amount = maxRaise
			}
			return protocol.ActionMsg{Action: "raise", Amount: amount}
		}
		return protocol.ActionMsg{Action: "call"}
	}

	if r.rng.Float64() < 0.08 {
		return protocol.ActionMsg{Action: "call"}
	}
	return protocol.ActionMsg{Action: "fold"}
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (r *Room) fallbackBotAction(player *PlayerState) protocol.ActionMsg {
	toCall := r.state.CurrentBet - player.Bet
	if toCall <= 0 {
		return protocol.ActionMsg{Action: "check"}
	}
	if toCall >= player.Stack {
		return protocol.ActionMsg{Action: "all_in"}
	}
	return protocol.ActionMsg{Action: "call"}
}

func (r *Room) botMaybeUseSkill(player *PlayerState) {
	if player.SkillUsedThisTurn || player.Heat >= skill.LockoutThreshold {
		return
	}
	if len(player.Skills) == 0 {
		return
	}
	skilliness := player.Skilliness
	if skilliness <= 0 {
		skilliness = 0.3
	}
	if r.rng.Float64() > 0.15+0.35*skilliness {
		return
	}
	candidates := make([]skill.Card, 0, len(player.Skills))
	for _, s := range player.Skills {
		if s.ID == "counter" {
			continue
		}
		candidates = append(candidates, s)
	}
	if len(candidates) == 0 {
		return
	}
	for i := 0; i < len(candidates); i++ {
		card := candidates[r.rng.Intn(len(candidates))]
		msg, ok := r.botSkillMsg(card, player)
		if !ok {
			continue
		}
		_ = r.handleSkill(Event{
			Type:     "skill",
			PlayerID: player.ID,
			Conn:     botConn{id: player.ID},
			Data:     msg,
		})
		return
	}
}

func (r *Room) botSkillMsg(card skill.Card, player *PlayerState) (protocol.SkillMsg, bool) {
	switch card.ID {
	case "peek":
		var targets []string
		for _, p := range r.state.Players {
			if p.ID == player.ID || !p.IsInHand() {
				continue
			}
			targets = append(targets, p.ID)
		}
		if len(targets) == 0 {
			return protocol.SkillMsg{}, false
		}
		target := targets[r.rng.Intn(len(targets))]
		return protocol.SkillMsg{SkillID: card.ID, TargetID: target}, true
	case "mist":
		if len(r.state.Community) == 0 {
			return protocol.SkillMsg{}, false
		}
		return protocol.SkillMsg{SkillID: card.ID}, true
	case "swap":
		if len(player.Hand) == 0 || len(r.state.Deck) == 0 {
			return protocol.SkillMsg{}, false
		}
		cardIdx := r.rng.Intn(len(player.Hand))
		return protocol.SkillMsg{SkillID: card.ID, CardIdx: cardIdx}, true
	case "bluff":
		return protocol.SkillMsg{SkillID: card.ID}, true
	default:
		return protocol.SkillMsg{}, false
	}
}

type botConn struct {
	id string
}

func (c botConn) ID() string {
	return c.id
}

func (c botConn) SendMessage(_ string, _ any) error {
	return nil
}
