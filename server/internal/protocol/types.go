package protocol

type JoinMsg struct {
	RoomID   string `json:"room_id"`
	PlayerID string `json:"player_id,omitempty"`
	Name     string `json:"name,omitempty"`
}

type ActionMsg struct {
	Action string `json:"action"`
	Amount int    `json:"amount,omitempty"`
}

type SkillMsg struct {
	SkillID  string `json:"skill_id"`
	TargetID string `json:"target_id,omitempty"`
	CardIdx  int    `json:"card_idx,omitempty"`
}

type AckMsg struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
	PlayerID string `json:"player_id,omitempty"`
}

type ErrorMsg struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type ActionRequestMsg struct {
	PlayerID     string   `json:"player_id"`
	ValidActions []string `json:"valid_actions"`
	ToCall       int      `json:"to_call"`
	MinRaise     int      `json:"min_raise"`
	MaxRaise     int      `json:"max_raise"`
	CanUseSkill  bool     `json:"can_use_skill"`
	TimeoutSec   int      `json:"timeout_sec"`
}

type GameStateMsg struct {
	Phase          string       `json:"phase"`
	TotalPot       int          `json:"total_pot"`
	CommunityCards []string     `json:"community_cards"`
	MyHand         []string     `json:"my_hand"`
	MySkills       []SkillInfo  `json:"my_skills"`
	MyHeat         int          `json:"my_heat"`
	Players        []PlayerInfo `json:"players"`
	CurrentPlayer  string       `json:"current_player"`
	DealerSeat     int          `json:"dealer_seat"`
}

type PlayerInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Seat        int      `json:"seat"`
	Stack       int      `json:"stack"`
	Bet         int      `json:"bet"`
	TotalBet    int      `json:"total_bet"`
	Status      string   `json:"status"`
	Hand        []string `json:"hand,omitempty"`
	HeatWarning bool     `json:"heat_warning"`
}

type SkillInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Cost int    `json:"cost"`
}

type SkillEffectMsg struct {
	SkillID  string      `json:"skill_id"`
	UserID   string      `json:"user_id"`
	TargetID string      `json:"target_id,omitempty"`
	Result   any         `json:"result,omitempty"`
	Blocked  bool        `json:"blocked"`
}
