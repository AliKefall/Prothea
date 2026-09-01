package matchmaking

import "errors"

type TimeControl struct {
	Name       string
	RatingType string
}

var SupportedTimeControls = []TimeControl{
	{
		Name:       "1+0",
		RatingType: "bullet",
	},
	{
		Name:       "1+1",
		RatingType: "bullet",
	},
	{
		Name:       "2+1",
		RatingType: "bullet",
	},
	{
		Name:       "3+0",
		RatingType: "blitz",
	},
	{
		Name:       "3+2",
		RatingType: "blitz",
	},
	{
		Name:       "5+0",
		RatingType: "blitz",
	},
	{
		Name:       "5+3",
		RatingType: "blitz",
	},
	{
		Name:       "10+0",
		RatingType: "rapid",
	},
	{
		Name:       "10+5",
		RatingType: "rapid",
	},
	{
		Name:       "15+10",
		RatingType: "rapid",
	},
	{
		Name:       "30+0",
		RatingType: "rapid",
	},
	{
		Name:       "30+20",
		RatingType: "rapid",
	},
}

func GetTimeControl(value string) (TimeControl, error) {
	for _, tc := range SupportedTimeControls {
		if tc.Name == value {
			return tc, nil
		}
	}

	return TimeControl{}, errors.New("unsupported time control")
}



