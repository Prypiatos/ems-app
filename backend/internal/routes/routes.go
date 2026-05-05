package routes

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	appmetrics "github.com/Prypiatos/ems-app/backend/internal/metrics"
	"github.com/Prypiatos/ems-app/backend/internal/middleware"
	"github.com/Prypiatos/ems-app/backend/internal/service"
	"github.com/Prypiatos/ems-app/backend/internal/stream"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Router struct {
	wsHub               *ws.Hub
	telemetryTopic      string
	state               *stream.State
	divisionService     *service.DivisionService
	clientBufferSize    int
	clientWriteDeadline time.Duration
	clientReadDeadline  time.Duration
	clientPingInterval  time.Duration
	engine              *gin.Engine
	http.Handler
}

type RouterBuilder struct {
	wsHub               *ws.Hub
	telemetryTopic      string
	state               *stream.State
	divisionService     *service.DivisionService
	clientBufferSize    int
	clientWriteDeadline time.Duration
	clientReadDeadline  time.Duration
	clientPingInterval  time.Duration
}

func NewRouterBuilder() *RouterBuilder {
	return &RouterBuilder{}
}

func (rb *RouterBuilder) WithWsHub(wsHub *ws.Hub) *RouterBuilder {
	rb.wsHub = wsHub
	return rb
}

func (rb *RouterBuilder) WithTelemetryTopic(telemetryTopic string) *RouterBuilder {
	rb.telemetryTopic = telemetryTopic
	return rb
}

func (rb *RouterBuilder) WithState(state *stream.State) *RouterBuilder {
	rb.state = state
	return rb
}

func (rb *RouterBuilder) WithDivisionService(divisionService *service.DivisionService) *RouterBuilder {
	rb.divisionService = divisionService
	return rb
}

func (rb *RouterBuilder) WithClientBufferSize(clientBufferSize int) *RouterBuilder {
	rb.clientBufferSize = clientBufferSize
	return rb
}

func (rb *RouterBuilder) WithClientWriteDeadline(clientWriteDeadline time.Duration) *RouterBuilder {
	rb.clientWriteDeadline = clientWriteDeadline
	return rb
}

func (rb *RouterBuilder) WithClientReadDeadline(clientReadDeadline time.Duration) *RouterBuilder {
	rb.clientReadDeadline = clientReadDeadline
	return rb
}

func (rb *RouterBuilder) WithClientPingInterval(clientPingInterval time.Duration) *RouterBuilder {
	rb.clientPingInterval = clientPingInterval
	return rb
}

func (rb *RouterBuilder) Build() *Router {
	rt := &Router{
		wsHub:               rb.wsHub,
		telemetryTopic:      rb.telemetryTopic,
		state:               rb.state,
		divisionService:     rb.divisionService,
		clientBufferSize:    rb.clientBufferSize,
		clientWriteDeadline: rb.clientWriteDeadline,
		clientReadDeadline:  rb.clientReadDeadline,
		clientPingInterval:  rb.clientPingInterval,
	}
	setupRoutes(rt)
	return rt
}

func setupRoutes(rt *Router) {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()

	engine.GET("/", rt.defaultHandler)
	engine.GET("/api/v1/health", rt.getHealth)
	engine.GET("/api/v1/readings", rt.getLiveReadings)
	engine.GET("/api/v1/nodes", rt.getNodes)
	engine.GET("/api/v1/nodes/:id/events", rt.getNodeEvents)
	engine.GET("/api/v1/nodes/:id/health", rt.getNodeHealth)
	engine.GET("/api/v1/divisions", rt.getDivisions)
	engine.GET("/api/v1/divisions/:id/summary", rt.getDivisionSummary)
	engine.GET("/metrics", rt.metricsHandler)

	rt.engine = engine
	rt.Handler = engine
}

func (rt *Router) Engine() *gin.Engine {
	return rt.engine
}

func (rt *Router) metricsHandler(c *gin.Context) {
	promhttp.HandlerFor(appmetrics.GetRegistry(), promhttp.HandlerOpts{}).ServeHTTP(c.Writer, c.Request)
}

func (rt *Router) defaultHandler(c *gin.Context) {
	c.String(http.StatusOK, "Welcome!!!")
}

func (rt *Router) getHealth(c *gin.Context) {
	c.Header("Content-Type", types.JSONContentType)
	c.JSON(http.StatusOK, map[string]any{"status": "ok"})
}

func (rt *Router) getLiveReadings(c *gin.Context) {
	conn, err := ws.Upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("", "error", err)
		return
	}

	middleware.IncWebSocketConnections()

	wsClient := ws.NewClient(conn, rt.clientBufferSize, rt.clientWriteDeadline, rt.clientReadDeadline, rt.clientPingInterval)
	rt.wsHub.Register(wsClient, rt.telemetryTopic)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()
	defer rt.wsHub.Kickout(wsClient, rt.telemetryTopic)
	defer middleware.DecWebSocketConnections()

	go wsClient.Write(ctx)
	go wsClient.PingLoop(ctx)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (rt *Router) getNodeEvents(c *gin.Context) {
	if rt.state == nil {
		c.String(http.StatusInternalServerError, "state not configured")
		return
	}

	nodeID := c.Param("id")
	limit := 20
	if q := c.Query("limit"); q != "" {
		parsed, err := strconv.Atoi(q)
		if err == nil && parsed > 0 {
			limit = parsed
		}
	}

	events := rt.state.GetEvents(nodeID, limit)
	c.Header("Content-Type", types.JSONContentType)
	c.JSON(http.StatusOK, events)
}

func (rt *Router) getNodes(c *gin.Context) {
	if rt.state == nil {
		c.String(http.StatusInternalServerError, "state not configured")
		return
	}

	c.Header("Content-Type", types.JSONContentType)
	c.JSON(http.StatusOK, rt.state.ListNodes())
}

func (rt *Router) getNodeHealth(c *gin.Context) {
	if rt.state == nil {
		c.String(http.StatusInternalServerError, "state not configured")
		return
	}

	nodeID := c.Param("id")
	health, ok := rt.state.GetHealth(nodeID)
	if !ok {
		health = stream.Health{
			NodeID:        nodeID,
			NodeType:      "unknown",
			Timestamp:     time.Now().UnixMilli(),
			SequenceNo:    0,
			Status:        "unknown",
			UptimeSec:     0,
			MQTTConnected: false,
			WiFiConnected: false,
			SensorOK:      false,
			BufferedCount: 0,
		}
	}

	c.Header("Content-Type", types.JSONContentType)
	c.JSON(http.StatusOK, health)
}

const requestTimeout = 10 * time.Second

func (rt *Router) getDivisions(c *gin.Context) {
	if rt.divisionService == nil {
		c.String(http.StatusInternalServerError, "division service not configured")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	divisions, err := rt.divisionService.GetHierarchy(ctx)
	if err != nil {
		slog.Error("failed to fetch divisions", "error", err)
		c.String(http.StatusInternalServerError, "failed to fetch divisions")
		return
	}

	c.Header("Content-Type", types.JSONContentType)
	c.JSON(http.StatusOK, divisions)
}

func (rt *Router) getDivisionSummary(c *gin.Context) {
	if rt.divisionService == nil {
		c.String(http.StatusInternalServerError, "division service not configured")
		return
	}

	idStr := c.Param("id")
	divisionID, err := uuid.Parse(idStr)
	if err != nil {
		c.String(http.StatusBadRequest, "invalid division id")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
	defer cancel()

	summary, err := rt.divisionService.GetDivisionSummary(ctx, divisionID)
	if err != nil {
		slog.Error("failed to fetch division summary", "error", err, "division_id", divisionID)
		c.String(http.StatusInternalServerError, "failed to fetch division summary")
		return
	}

	c.Header("Content-Type", types.JSONContentType)
	c.JSON(http.StatusOK, summary)
}
