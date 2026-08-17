package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	algorithm = "argon2id"
	version   = 19
)

type PasswordHasher struct {
	memory      uint32
	time        uint32
	parallelism uint8
	keyLen      uint32
	saltLen     uint32
}

func NewPasswordHasher() *PasswordHasher {
	return &PasswordHasher{
		memory:      64 * 1024,
		time:        3,
		parallelism: 2,
		keyLen:      32,
		saltLen:     16,
	}
}

func (p *PasswordHasher) Hash(password string) (string, error) {
	salt := make([]byte, p.saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		p.time,
		p.memory,
		p.parallelism,
		p.keyLen,
	)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	return fmt.Sprintf(
		"%s$v=%d$m=%d,t=%d,p=%d$%s$%s",
		algorithm,
		version,
		p.memory,
		p.time,
		p.parallelism,
		b64Salt,
		b64Hash,
	), nil
}

func (p *PasswordHasher) Verify(password, encoded string) (bool, error) {

	parts := strings.Split(encoded, "$")
	if len(parts) != 5 {
		return false, fmt.Errorf("invalid hash format: got %d parts", len(parts))
	}

	if parts[0] != algorithm {
		return false, errors.New("unsupported algorithm")
	}

	// version
	if !strings.HasPrefix(parts[1], "v=") {
		return false, errors.New("invalid version format")
	}

	parsedVersion, err := strconv.Atoi(strings.TrimPrefix(parts[1], "v="))
	if err != nil {
		return false, err
	}

	if parsedVersion != version {
		return false, errors.New("incompatible version")
	}

	// params (STRICT PARSE)
	params := strings.Split(parts[2], ",")

	var memory, time uint32
	var parallelism uint8

	for _, param := range params {
		kv := strings.Split(param, "=")
		if len(kv) != 2 {
			return false, fmt.Errorf("invalid param segment: %s", param)
		}

		val, err := strconv.Atoi(kv[1])
		if err != nil {
			return false, err
		}

		switch kv[0] {
		case "m":
			memory = uint32(val)
		case "t":
			time = uint32(val)
		case "p":
			parallelism = uint8(val)
		}
	}

	if memory == 0 || time == 0 || parallelism == 0 {
		return false, errors.New("invalid parsed parameters")
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false, err
	}

	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		time,
		memory,
		parallelism,
		p.keyLen,
	)

	if subtle.ConstantTimeCompare(hash, expectedHash) == 1 {
		return true, nil
	}

	return false, nil
}
