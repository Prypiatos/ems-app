-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
 
-- ── divisions ────────────────────────────────────────────────────────────────
CREATE TABLE divisions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR     NOT NULL,
    parent_id   UUID        REFERENCES divisions(id) ON DELETE SET NULL,
    floor       VARCHAR,
    building    VARCHAR,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
 
-- ── devices ──────────────────────────────────────────────────────────────────
CREATE TABLE devices (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR     NOT NULL,
    division_id  UUID        NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    protocol     VARCHAR     NOT NULL,
    status       VARCHAR     NOT NULL DEFAULT 'online',
    last_seen_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
 
CREATE INDEX idx_devices_division_id ON devices(division_id);
 
-- ── alert_rules ───────────────────────────────────────────────────────────────
CREATE TABLE alert_rules (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id         UUID        NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    metric              VARCHAR     NOT NULL,
    operator            VARCHAR     NOT NULL,
    threshold           FLOAT8      NOT NULL,
    severity            VARCHAR     NOT NULL,
    cooldown_seconds    INT         NOT NULL DEFAULT 300,
    escalation_minutes  INT         NOT NULL DEFAULT 15,
    enabled             BOOL        NOT NULL DEFAULT true,
    created_by          UUID        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
 
CREATE INDEX idx_alert_rules_division_enabled
    ON alert_rules(division_id)
    WHERE enabled = true;
 
-- ── alerts ────────────────────────────────────────────────────────────────────
CREATE TABLE alerts (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type             VARCHAR     NOT NULL,
    severity         VARCHAR     NOT NULL,
    status           VARCHAR     NOT NULL DEFAULT 'active',
    device_id        UUID,
    division_id      UUID        NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    message          TEXT        NOT NULL,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rule_id          UUID        REFERENCES alert_rules(id) ON DELETE SET NULL,
    acknowledged_by  UUID,
    acknowledged_at  TIMESTAMPTZ,
    resolved_at      TIMESTAMPTZ,
    escalated_at     TIMESTAMPTZ,
    notes            TEXT
);
 
CREATE INDEX idx_alerts_active_division
    ON alerts(division_id)
    WHERE status = 'active';
 
CREATE INDEX idx_alerts_status_severity
    ON alerts(status, severity);
 
-- ── user_preferences ─────────────────────────────────────────────────────────
CREATE TABLE user_preferences (
    user_id                 UUID        PRIMARY KEY,
    notification_channels   JSONB       NOT NULL DEFAULT '["in_app"]',
    alert_severity_filter   JSONB       NOT NULL DEFAULT '["warning","critical"]',
    sound_enabled           BOOL        NOT NULL DEFAULT true,
    theme                   VARCHAR     NOT NULL DEFAULT 'dark',
    default_division_id     UUID        REFERENCES divisions(id) ON DELETE SET NULL,
    default_period          VARCHAR     NOT NULL DEFAULT '24h',
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
 
-- ── tariff_rates ─────────────────────────────────────────────────────────────
CREATE TABLE tariff_rates (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR NOT NULL,
    peak_rate         FLOAT8  NOT NULL,
    off_peak_rate     FLOAT8  NOT NULL,
    weekend_rate      FLOAT8  NOT NULL,
    peak_hours_start  TIME    NOT NULL,
    peak_hours_end    TIME    NOT NULL,
    currency          VARCHAR NOT NULL DEFAULT 'USD',
    effective_from    DATE    NOT NULL,
    effective_to      DATE,
    is_active         BOOL    NOT NULL DEFAULT true
);
