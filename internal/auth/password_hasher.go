package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

const (
	algorithm = "argon2id"
	version   = 19
)

type PasswordHasher struct {
	memory        uint32
	time          uint32
	parallelism   uint8
	keyLen        uint32
	saltLen       uint32
	dummyHashOnce sync.Once
	dummyHash     string
	dummyHashErr  error
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
	if utf8.RuneCountInString(password) > 128 || len(password) > 512 {
		return "", errors.New("password is too long")
	}
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
	if utf8.RuneCountInString(password) > 128 || len(password) > 512 {
		return false, errors.New("password is too long")
	}

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

	var memoryValue, timeValue, parallelismValue int

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
			memoryValue = val
		case "t":
			timeValue = val
		case "p":
			parallelismValue = val
		}
	}

	if parallelismValue < 1 || parallelismValue > 16 ||
		memoryValue < 8*parallelismValue || memoryValue > 256*1024 ||
		timeValue < 1 || timeValue > 10 {
		return false, errors.New("invalid parsed parameters")
	}
	memory := uint32(memoryValue)
	iterations := uint32(timeValue)
	parallelism := uint8(parallelismValue)

	salt, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false, err
	}

	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}
	if len(salt) < 8 || len(salt) > 64 || len(expectedHash) != int(p.keyLen) {
		return false, errors.New("invalid password hash size")
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		iterations,
		memory,
		parallelism,
		p.keyLen,
	)

	if subtle.ConstantTimeCompare(hash, expectedHash) == 1 {
		return true, nil
	}

	return false, nil
}

func (p *PasswordHasher) VerifyUnknownUser(password string) error {
	initialized := false
	p.dummyHashOnce.Do(func() {
		initialized = true
		secret := make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			p.dummyHashErr = err
			return
		}
		p.dummyHash, p.dummyHashErr = p.Hash(base64.RawStdEncoding.EncodeToString(secret))
	})
	if p.dummyHashErr != nil {
		return p.dummyHashErr
	}
	if initialized {
		return nil
	}
	_, err := p.Verify(password, p.dummyHash)
	return err
}
