package elo

import "math"

const (
	DefaultRating = 1500
	DefaultRD = 350.0
	DefaultVolatility = 0.06 // This should be optimized, have to be between 0.04 and 0.012

	MinRD = 30.0
	MaxRD = 350.0

	DefaultTau = 0.5
	GlickoScale = 173.7178 // This is a constant don't change this one
	ConvergenceEpsilon = 0.000001

	MinRating = 100.0
	MaxRating = 4000.0

	ProvisionalGames = 20 // After 20 games their elo is set to whatever they need to be set.
)

type Rating struct{
	Value float64
	RD float64
	Volatility float64
	GamesPlayed int
}

type MatchResult struct{
	Opponent Rating
	Score float64
}

func NewRating() Rating {
	return Rating{
		Value: DefaultRating,
		RD: DefaultRD,
		Volatility: DefaultVolatility,
		GamesPlayed: 0,
	}
}

func (r Rating) IsProvisional() bool {
	return r.GamesPlayed < ProvisionalGames
}

func Update(current Rating, match MatchResult) Rating {
	mu := (current.Value - DefaultRating) / GlickoScale
	phi := current.RD / GlickoScale

	opponentMu := (match.Opponent.Value - DefaultRating) / GlickoScale
	opponentPhi := match.Opponent.RD / GlickoScale

	g := g(opponentPhi)
	e := expectedScore(mu, opponentMu, opponentPhi)

	v := 1.0 / (g * g * e * (1.0 - e))

	delta := v * g * (match.Score - e)

	sigmaPrime := computeSigmaPrime(
		phi,
		current.Volatility,
		delta,
		v,
	)

	phiStar := math.Sqrt(
		phi*phi + sigmaPrime*sigmaPrime,
	)

	phiPrime := 1.0 / math.Sqrt(
		(1.0/(phiStar*phiStar))+(1.0/v),
	)

	muPrime := mu + (phiPrime*phiPrime)*g*(match.Score-e)

	newRating := (muPrime * GlickoScale) + DefaultRating
	newRD := phiPrime * GlickoScale

	newRD = clamp(newRD, MinRD, MaxRD)
	newRating = clamp(newRating, MinRating, MaxRating)

	return Rating{
		Value:       newRating,
		RD:          newRD,
		Volatility:  sigmaPrime,
		GamesPlayed: current.GamesPlayed + 1,
	}
}

func Decay(current Rating) Rating {
	phi := current.RD / GlickoScale

	phiStar := math.Sqrt(
		phi*phi + current.Volatility*current.Volatility,
	)

	newRD := clamp(
		phiStar*GlickoScale,
		MinRD,
		MaxRD,
	)

	return Rating{
		Value:       current.Value,
		RD:          newRD,
		Volatility:  current.Volatility,
		GamesPlayed: current.GamesPlayed,
	}
}

func g(phi float64) float64 {
	return 1.0 / math.Sqrt(
		1.0+(3.0*phi*phi)/(math.Pi*math.Pi),
	)
}

func expectedScore(
	mu float64,
	opponentMu float64,
	opponentPhi float64,
) float64 {
	return 1.0 / (1.0 + math.Exp(
		-g(opponentPhi)*(mu-opponentMu),
	))
}

func computeSigmaPrime(
	phi float64,
	sigma float64,
	delta float64,
	v float64,
) float64 {
	a := math.Log(sigma * sigma)

	f := func(x float64) float64 {
		expX := math.Exp(x)

		numerator := expX * (delta*delta - phi*phi - v - expX)

		denominator := 2.0 * math.Pow(
			phi*phi+v+expX,
			2,
		)

		return (numerator / denominator) - ((x - a) / (DefaultTau * DefaultTau))
	}

	A := a

	var B float64

	if delta*delta > phi*phi+v {
		B = math.Log(delta*delta - phi*phi - v)
	} else {
		k := 1.0

		for f(a-k*DefaultTau) < 0 {
			k++

			if k > 100 {
				break
			}
		}

		B = a - (k * DefaultTau)
	}

	fA := f(A)
	fB := f(B)

	for math.Abs(B-A) > ConvergenceEpsilon {
		C := A + ((A-B)*fA)/(fB-fA)

		fC := f(C)

		if fC*fB < 0 {
			A = B
			fA = fB
		} else {
			fA = fA / 2.0
		}

		B = C
		fB = fC
	}

	return math.Exp(B / 2.0)
}

func clamp(
	value float64,
	min float64,
	max float64,
) float64 {
	return math.Max(
		min,
		math.Min(max, value),
	)
}

