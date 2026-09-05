package game

import (
	"context"
	"fmt"

	"github.com/corentings/chess/v2"
)

type ChessValidator struct{}

func NewChessValidator() *ChessValidator {
	return &ChessValidator{}
}

func (v *ChessValidator) Validate(
	_ context.Context,
	fen string,
	from string,
	to string,
	promotion string,
) (ValidatedMove, error) {
	position, err := chess.FEN(fen)
	if err != nil {
		return ValidatedMove{}, fmt.Errorf(
			"parse FEN: %w",
			err,
		)
	}

	game := chess.NewGame(position)

	uci := fmt.Sprintf(
		"%s%s%s",
		from,
		to,
		promotion,
	)

	/*
	 * Hamleyi uygulamadan önce mevcut pozisyonu
	 * saklıyoruz.
	 *
	 * SAN encoder hamleyi bu pozisyona göre
	 * hesaplıyor.
	 */
	previousPosition := game.Position()

	if err := game.PushNotationMove(
		uci,
		chess.UCINotation{},
		nil,
	); err != nil {
		return ValidatedMove{}, ErrInvalidMove
	}

	moves := game.Moves()
	if len(moves) == 0 {
		return ValidatedMove{}, ErrInvalidMove
	}

	lastMove := moves[len(moves)-1]

	/*
	 * Move.String() SAN değildir.
	 *
	 * AlgebraicNotation.Encode(), hamleyi
	 * Standard Algebraic Notation'a çevirir.
	 */
	san := chess.AlgebraicNotation{}.Encode(
		previousPosition,
		lastMove,
	)

	return ValidatedMove{
		SAN:      san,
		UCI:      uci,
		FENAfter: game.FEN(),
	}, nil
}
