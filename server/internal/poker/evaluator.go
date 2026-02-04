package poker

import "sort"

func EvaluateBest(cards []Card) HandRank {
	best := HandRank{Category: -1}
	if len(cards) < 5 {
		return best
	}
	n := len(cards)
	for i := 0; i < n-4; i++ {
		for j := i + 1; j < n-3; j++ {
			for k := j + 1; k < n-2; k++ {
				for l := k + 1; l < n-1; l++ {
					for m := l + 1; m < n; m++ {
						hand := []Card{cards[i], cards[j], cards[k], cards[l], cards[m]}
						rank := evaluate5(hand)
						if rank.Compare(best) > 0 {
							best = rank
						}
					}
				}
			}
		}
	}
	return best
}

func evaluate5(cards []Card) HandRank {
	rankCounts := map[int]int{}
	suitCounts := map[Suit]int{}
	for _, c := range cards {
		rankCounts[c.Rank]++
		suitCounts[c.Suit]++
	}

	flushSuit := Suit(-1)
	for s, cnt := range suitCounts {
		if cnt == 5 {
			flushSuit = s
			break
		}
	}

	if flushSuit != -1 {
		flushRanks := make([]int, 0, 5)
		for _, c := range cards {
			if c.Suit == flushSuit {
				flushRanks = append(flushRanks, c.Rank)
			}
		}
		if high := straightHigh(flushRanks); high > 0 {
			return HandRank{Category: 8, Kickers: []int{high}}
		}
		sortRanksDesc(flushRanks)
		return HandRank{Category: 5, Kickers: flushRanks}
	}

	if high := straightHigh(ranksFromCounts(rankCounts)); high > 0 {
		return HandRank{Category: 4, Kickers: []int{high}}
	}

	type rc struct {
		rank  int
		count int
	}
	var groups []rc
	for r, c := range rankCounts {
		groups = append(groups, rc{rank: r, count: c})
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].count == groups[j].count {
			return groups[i].rank > groups[j].rank
		}
		return groups[i].count > groups[j].count
	})

	switch groups[0].count {
	case 4:
		kicker := highestOtherRank(rankCounts, groups[0].rank)
		return HandRank{Category: 7, Kickers: []int{groups[0].rank, kicker}}
	case 3:
		if len(groups) > 1 && groups[1].count == 2 {
			return HandRank{Category: 6, Kickers: []int{groups[0].rank, groups[1].rank}}
		}
		kickers := []int{groups[0].rank}
		others := ranksExcluding(rankCounts, groups[0].rank)
		sortRanksDesc(others)
		kickers = append(kickers, others...)
		return HandRank{Category: 3, Kickers: kickers}
	case 2:
		if len(groups) > 1 && groups[1].count == 2 {
			highPair := groups[0].rank
			lowPair := groups[1].rank
			kicker := highestOtherRank(rankCounts, highPair, lowPair)
			return HandRank{Category: 2, Kickers: []int{highPair, lowPair, kicker}}
		}
		pair := groups[0].rank
		others := ranksExcluding(rankCounts, pair)
		sortRanksDesc(others)
		kickers := append([]int{pair}, others...)
		return HandRank{Category: 1, Kickers: kickers}
	default:
		ranks := ranksFromCounts(rankCounts)
		sortRanksDesc(ranks)
		return HandRank{Category: 0, Kickers: ranks}
	}
}

func straightHigh(ranks []int) int {
	if len(ranks) < 5 {
		return 0
	}
	present := make([]bool, 15)
	for _, r := range ranks {
		if r >= 2 && r <= 14 {
			present[r] = true
			if r == 14 {
				present[1] = true
			}
		}
	}
	for high := 14; high >= 5; high-- {
		if present[high] && present[high-1] && present[high-2] && present[high-3] && present[high-4] {
			return high
		}
	}
	return 0
}

func ranksFromCounts(counts map[int]int) []int {
	ranks := make([]int, 0, len(counts))
	for r := range counts {
		ranks = append(ranks, r)
	}
	return ranks
}

func ranksExcluding(counts map[int]int, exclude ...int) []int {
	ex := map[int]bool{}
	for _, r := range exclude {
		ex[r] = true
	}
	var ranks []int
	for r := range counts {
		if !ex[r] {
			ranks = append(ranks, r)
		}
	}
	return ranks
}

func highestOtherRank(counts map[int]int, exclude ...int) int {
	ex := map[int]bool{}
	for _, r := range exclude {
		ex[r] = true
	}
	best := 0
	for r := range counts {
		if ex[r] {
			continue
		}
		if r > best {
			best = r
		}
	}
	return best
}

func sortRanksDesc(ranks []int) {
	sort.Slice(ranks, func(i, j int) bool { return ranks[i] > ranks[j] })
}
