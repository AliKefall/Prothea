package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secret    []byte
	expiresIn time.Duration
}

const (
	issuer   = "Ganymede"
	audience = "prothea-api"
)

func NewJWTManager(secret string, expiresIn time.Duration) (*JWTManager, error) {
	if len(secret) < 32 {
		return nil, errors.New("JWT_SECRET must contain at least 32 bytes of cryptographically random data")
	}
	if expiresIn <= 0 {
		return nil, errors.New("access token lifetime must be positive")
	}
	return &JWTManager{
		secret:    []byte(secret),
		expiresIn: expiresIn,
	}, nil
}

func (j *JWTManager) Generate(userID string, sessionID string) (string, error) {
	claims := Claims{
		UserID:    userID,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   userID,
			Audience:  jwt.ClaimStrings{audience},
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(j.expiresIn)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(j.secret)
}

func (j *JWTManager) Verify(tokenStr string) (*Claims, error) {
	if len(tokenStr) == 0 || len(tokenStr) > 4096 {
		return nil, errors.New("invalid token size")
	}
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return j.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(issuer), jwt.WithAudience(audience), jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil {
		return nil, err
	}
	parsedClaims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid || parsedClaims.UserID == "" || parsedClaims.SessionID == "" || parsedClaims.Subject != parsedClaims.UserID || parsedClaims.IssuedAt == nil {
		return nil, errors.New("Invalid token")
	}
	return parsedClaims, nil
}

func MakeRefreshToken() (string, error) {
	token := make([]byte, 32)
	_, err := rand.Read(token)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(token), nil
}
