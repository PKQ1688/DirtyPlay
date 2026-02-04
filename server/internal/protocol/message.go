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
