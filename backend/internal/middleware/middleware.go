package middleware

import (
	"bufio"
	"context"
	"crypto/rsa"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("http.ResponseWriter does not support hijacking")
	}
	return hijacker.Hijack()
}

func WithAppContext(appCtx context.Context) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithCancelCause(r.Context())
			defer cancel(nil)

			go func() {
				select {
				case <-appCtx.Done():
					cancel(fmt.Errorf("app shutting down"))
				case <-ctx.Done():
				}
			}()

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RecoveryMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					slog.ErrorContext(r.Context(), "panic recovered",
						slog.Any("error", err),
						slog.String("stack", string(debug.Stack())),
					)

					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

func LoggingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			rw := &responseWriter{
				ResponseWriter: w,
				status:         http.StatusOK,
			}

			next.ServeHTTP(rw, r)

			duration := time.Since(start)
			reqID := GetRequestID(r.Context())

			slog.Info("http request",
				slog.String("request_id", reqID),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rw.status),
				slog.Duration("duration", duration),
				slog.String("remote_addr", r.RemoteAddr),
			)
		})
	}
}

type ctxKey string

const requestIDKey ctxKey = "request_id"

func RequestIDMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id, _ := uuid.NewV7()
			ctx := context.WithValue(r.Context(), requestIDKey, id.String())

			w.Header().Set("X-Request-ID", id.String())

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func CORSMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}

func Chain(h http.Handler, m ...func(http.Handler) http.Handler) http.Handler {
	for i := len(m) - 1; i >= 0; i-- {
		h = m[i](h)
	}
	return h
}

func GinWithAppContext(appCtx context.Context) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithCancelCause(c.Request.Context())
		defer cancel(nil)

		go func() {
			select {
			case <-appCtx.Done():
				cancel(fmt.Errorf("app shutting down"))
			case <-ctx.Done():
			}
		}()

		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func GinRecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				slog.ErrorContext(c.Request.Context(), "panic recovered",
					slog.Any("error", err),
					slog.String("stack", string(debug.Stack())),
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			}
		}()
		c.Next()
	}
}

func GinLoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		duration := time.Since(start)
		reqID := GetRequestID(c.Request.Context())

		slog.Info("http request",
			slog.String("request_id", reqID),
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("duration", duration),
			slog.String("remote_addr", c.Request.RemoteAddr),
		)
	}
}

func GinRequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := uuid.NewV7()
		ctx := context.WithValue(c.Request.Context(), requestIDKey, id.String())

		c.Request = c.Request.WithContext(ctx)
		c.Writer.Header().Set("X-Request-ID", id.String())

		c.Next()
	}
}

func GinCORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func GinPrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		duration := time.Since(start).Seconds()
		path := c.Request.URL.Path
		status := strconv.Itoa(c.Writer.Status())

		httpRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
	}
}

func GinJWTMiddleware(cfg JWTConfig) gin.HandlerFunc {
	if cfg.IssuerURL == "" {
		slog.Warn("JWT middleware disabled: KEYCLOAK_ISSUER not set")
		return func(c *gin.Context) { c.Next() }
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

	return func(c *gin.Context) {
		// Skip paths that don't require auth
		if skipSet[c.Request.URL.Path] {
			c.Next()
			return
		}

		// Extract Bearer token
		authHeader := c.Request.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid Authorization header"})
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate
		claims, err := validateToken(token, jwksURL, expectedIssuer, cache)
		if err != nil {
			slog.Warn("JWT validation failed", "error", err, "path", c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		// Attach claims to context
		ctx := context.WithValue(c.Request.Context(), claimsKey, claims)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
