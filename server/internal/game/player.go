package game

import (
	"time"

	"dirtyplay-server/internal/poker"
	"dirtyplay-server/internal/skill"
)

const (
	StatusActive = "active"
	StatusFolded = "folded"
	StatusAllIn  = "all_in"
	StatusOut    = "out"
)

type PlayerState struct {
	ID              string
	Name            string
	Seat            int
	Stack           int
	Bet             int
	TotalBet        int
	Status          string
	IsBot           bool
	Aggression      float64
	Skilliness      float64
	Hand            []poker.Card
	Skills          []skill.Card
	Heat            int
	ActedThisRound  bool
	SkillUsedThisTurn bool
	DisconnectedAt  time.Time
}

func (p *PlayerState) IsInHand() bool {
	return p.Status != StatusFolded && p.Status != StatusOut
}

func (p *PlayerState) CanAct() bool {
	return p.Status == StatusActive
}

func (p *PlayerState) ResetForHand() {
	p.Bet = 0
	p.TotalBet = 0
	p.Hand = nil
	p.Status = StatusActive
	p.ActedThisRound = false
	p.SkillUsedThisTurn = false
}

func (p *PlayerState) RemoveSkill(skillID string) bool {
	for i, s := range p.Skills {
		if s.ID == skillID {
			p.Skills = append(p.Skills[:i], p.Skills[i+1:]...)
			return true
		}
	}
	return false
}
