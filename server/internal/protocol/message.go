package protocol

import "encoding/json"

type Message struct {
	Type    string          `json:"type"`
	Seq     int64           `json:"seq"`
	Payload json.RawMessage `json:"payload"`
}

func EncodeMessage(msgType string, seq int64, payload any) ([]byte, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	msg := Message{
		Type:    msgType,
		Seq:     seq,
		Payload: raw,
	}
	return json.Marshal(msg)
}

// CreateRoomMsg is sent C→S to create a new room (server auto-joins the sender).
type CreateRoomMsg struct {
	Name       string `json:"name,omitempty"`
	QuickStart bool   `json:"quick_start,omitempty"`
}

// RoomCreatedMsg is sent S→C after a room is successfully created.
type RoomCreatedMsg struct {
	RoomID   string `json:"room_id"`
	Code     string `json:"code"`
	PlayerID string `json:"player_id"`
}

// JoinByCodeMsg is sent C→S to join a room via 6-character invite code.
type JoinByCodeMsg struct {
	Code     string `json:"code"`
	Name     string `json:"name,omitempty"`
	PlayerID string `json:"player_id,omitempty"`
}

// AddBotMsg is sent C→S to add one AI opponent to the current room.
type AddBotMsg struct{}

// StartGameMsg is sent C→S to manually start a waiting room that already has enough players.
type StartGameMsg struct{}
