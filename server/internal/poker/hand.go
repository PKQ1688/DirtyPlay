package poker

type HandRank struct {
	Category int
	Kickers  []int
}

func (r HandRank) Compare(other HandRank) int {
	if r.Category != other.Category {
		if r.Category > other.Category {
			return 1
		}
		return -1
	}
	for i := 0; i < len(r.Kickers) && i < len(other.Kickers); i++ {
		if r.Kickers[i] != other.Kickers[i] {
			if r.Kickers[i] > other.Kickers[i] {
				return 1
			}
			return -1
		}
	}
	return 0
}
