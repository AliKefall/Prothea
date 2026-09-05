package elo

import (
	"errors"
	"strconv"
	"strings"
)

type RatingType string

const (
	RatingTypeBullet RatingType = "bullet"
	RatingTypeBlitz  RatingType = "blitz"
	RatingTypeRapid  RatingType = "rapid"
)

var ErrInvalidTimeControl = errors.New("invalid time control")

func RatingTypeFromTimeControl(
	timeControl string,
) (RatingType, error) {
	parts := strings.Split(timeControl, "+")
	if len(parts) != 2 {
		return "", ErrInvalidTimeControl
	}

	minutes, err := strconv.Atoi(parts[0])
	if err != nil || minutes <= 0 {
		return "", ErrInvalidTimeControl
	}

	switch minutes {
	case 1, 2:
		return RatingTypeBullet, nil

	case 3, 5:
		return RatingTypeBlitz, nil

	case 10, 15, 30:
		return RatingTypeRapid, nil

	default:
		return "", ErrInvalidTimeControl
	}
}
