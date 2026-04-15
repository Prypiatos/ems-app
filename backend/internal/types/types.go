package types

import "errors"

const JSONContentType = "application/json"

const (
	ONLINE           = "online"
	DEGRADED         = "degraded"
	OFFLINE_INTENDED = "offline_intended"
)

var (
	ErrNodeNotFound = errors.New("Node not found")
	ErrMockError    = errors.New("mock error")
)
