package skill

const (
	MaxHeat          = 100
	WarningThreshold = 70
	LockoutThreshold = 100
	HeatDecayPerHand = 10
)

func AddHeat(value int, delta int) int {
	value += delta
	if value > MaxHeat {
		return MaxHeat
	}
	return value
}

func DecayHeat(value int) int {
	value -= HeatDecayPerHand
	if value < 0 {
		return 0
	}
	return value
}
