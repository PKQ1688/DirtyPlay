package game

type Conn interface {
	ID() string
	SendMessage(msgType string, payload any) error
}
