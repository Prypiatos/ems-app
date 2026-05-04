package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRequestIDMiddlewareSetsHeaderAndContext(t *testing.T) {
	var seenID string
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenID = GetRequestID(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	RequestIDMiddleware()(handler).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if seenID == "" {
		t.Fatal("request id missing from context")
	}
	if headerID := rec.Header().Get("X-Request-ID"); headerID != seenID {
		t.Fatalf("X-Request-ID = %q, want %q", headerID, seenID)
	}
}

func TestWithAppContextCancelsRequestOnShutdown(t *testing.T) {
	appCtx, cancelApp := context.WithCancel(context.Background())
	defer cancelApp()

	done := make(chan error, 1)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
		done <- context.Cause(r.Context())
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	go WithAppContext(appCtx)(handler).ServeHTTP(rec, req)
	time.Sleep(20 * time.Millisecond)
	cancelApp()

	select {
	case err := <-done:
		if err == nil || !strings.Contains(err.Error(), "app shutting down") {
			t.Fatalf("context cause = %v, want app shutdown", err)
		}
	case <-time.After(time.Second):
		t.Fatal("request context not canceled")
	}
}

func TestRecoveryMiddlewareReturns500OnPanic(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	RecoveryMiddleware()(handler).ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if body := rec.Body.String(); !strings.Contains(body, "Internal Server Error") {
		t.Fatalf("body = %q, want internal server error", body)
	}
}
