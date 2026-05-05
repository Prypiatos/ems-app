package middleware

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// JWTConfig holds settings for Keycloak JWT validation.
type JWTConfig struct {
	// IssuerURL is the Keycloak realm URL, e.g. http://keycloak:8180/realms/ems
	IssuerURL string
	// ExternalIssuerURL is the Keycloak realm URL expected in the 'iss' claim.
	// If empty, IssuerURL is used.
	ExternalIssuerURL string
	// SkipPaths are paths that don't require authentication
	SkipPaths []string
}

type jwks struct {
	Keys []jwk `json:"keys"`
}

type jwk struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	Typ string `json:"typ"`
}

// JWTClaims holds the validated claims from a Keycloak JWT.
type JWTClaims struct {
	Iss        string   `json:"iss"`
	Sub        string   `json:"sub"`
	Aud        any      `json:"aud"`
	Exp        int64    `json:"exp"`
	Iat        int64    `json:"iat"`
	RealmRoles []string `json:"realm_roles"`
}

type keyCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
	ttl     time.Duration
}

type ctxClaimsKey string

const claimsKey ctxClaimsKey = "jwt_claims"

// JWTMiddleware validates Bearer tokens issued by Keycloak.
// If IssuerURL is empty, the middleware is a no-op (pass-through).
func JWTMiddleware(cfg JWTConfig) func(http.Handler) http.Handler {
	if cfg.IssuerURL == "" {
		slog.Warn("JWT middleware disabled: KEYCLOAK_ISSUER not set")
		return func(next http.Handler) http.Handler { return next }
	}

	expectedIssuer := cfg.ExternalIssuerURL
	if expectedIssuer == "" {
		expectedIssuer = cfg.IssuerURL
	}

	cache := &keyCache{
		keys: make(map[string]*rsa.PublicKey),
		ttl:  10 * time.Minute,
	}

	skipSet := make(map[string]bool, len(cfg.SkipPaths))
	for _, p := range cfg.SkipPaths {
		skipSet[p] = true
	}

	jwksURL := cfg.IssuerURL + "/protocol/openid-connect/certs"
	slog.Info("JWT middleware enabled", "issuer", expectedIssuer, "jwks", jwksURL)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip paths that don't require auth
			if skipSet[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			// Extract Bearer token
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"missing or invalid Authorization header"}`, http.StatusUnauthorized)
				return
			}
			token := strings.TrimPrefix(authHeader, "Bearer ")

			// Parse and validate
			claims, err := validateToken(token, jwksURL, expectedIssuer, cache)
			if err != nil {
				slog.Warn("JWT validation failed", "error", err, "path", r.URL.Path)
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnauthorized)
				return
			}

			// Attach claims to context
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetJWTClaims retrieves the validated JWT claims from the request context.
func GetJWTClaims(ctx context.Context) *JWTClaims {
	if claims, ok := ctx.Value(claimsKey).(*JWTClaims); ok {
		return claims
	}
	return nil
}

func validateToken(tokenStr, jwksURL, issuer string, cache *keyCache) (*JWTClaims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	// Decode header
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid token header")
	}
	var header jwtHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("invalid token header")
	}

	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported algorithm: %s", header.Alg)
	}

	// Decode claims
	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid token claims")
	}
	var claims JWTClaims
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Check expiry
	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}

	// Check issuer
	if claims.Iss != issuer {
		return nil, fmt.Errorf("invalid issuer: %s", claims.Iss)
	}

	// Get public key and verify signature
	pubKey, err := getPublicKey(header.Kid, jwksURL, cache)
	if err != nil {
		return nil, fmt.Errorf("failed to get public key: %w", err)
	}

	// Verify RSA-SHA256 signature
	signingInput := []byte(parts[0] + "." + parts[1])
	hash := sha256.Sum256(signingInput)

	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("invalid signature encoding")
	}

	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, hash[:], signature); err != nil {
		return nil, fmt.Errorf("invalid signature")
	}

	return &claims, nil
}

func getPublicKey(kid, jwksURL string, cache *keyCache) (*rsa.PublicKey, error) {
	// Check cache first
	cache.mu.RLock()
	if key, ok := cache.keys[kid]; ok && time.Since(cache.fetched) < cache.ttl {
		cache.mu.RUnlock()
		return key, nil
	}
	cache.mu.RUnlock()

	// Fetch JWKS
	cache.mu.Lock()
	defer cache.mu.Unlock()

	// Double-check after acquiring write lock
	if key, ok := cache.keys[kid]; ok && time.Since(cache.fetched) < cache.ttl {
		return key, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS returned status %d", resp.StatusCode)
	}

	var keySet jwks
	if err := json.NewDecoder(resp.Body).Decode(&keySet); err != nil {
		return nil, fmt.Errorf("failed to decode JWKS: %w", err)
	}

	// Parse all keys into cache
	newKeys := make(map[string]*rsa.PublicKey)
	for _, k := range keySet.Keys {
		if k.Kty != "RSA" || k.Use != "sig" {
			continue
		}
		pubKey, err := parseRSAPublicKey(k)
		if err != nil {
			slog.Warn("failed to parse JWK", "kid", k.Kid, "error", err)
			continue
		}
		newKeys[k.Kid] = pubKey
	}

	cache.keys = newKeys
	cache.fetched = time.Now()

	key, ok := newKeys[kid]
	if !ok {
		return nil, fmt.Errorf("key %s not found in JWKS", kid)
	}
	return key, nil
}

func parseRSAPublicKey(k jwk) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}

	return &rsa.PublicKey{N: n, E: e}, nil
}
