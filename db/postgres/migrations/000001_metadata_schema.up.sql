CREATE TABLE divisions (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    parent_id UUID NULL REFERENCES divisions(id) ON DELETE SET NULL,
    floor VARCHAR NOT NULL,
    building VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE RESTRICT,
    protocol VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'online',
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY,
    type VARCHAR NOT NULL,
    severity VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'active',
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rule_id UUID NULL,
    acknowledged_by UUID NULL,
    acknowledged_at TIMESTAMPTZ NULL,
    resolved_at TIMESTAMPTZ NULL,
    escalated_at TIMESTAMPTZ NULL,
    notes TEXT NULL
);

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY,
    division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    metric VARCHAR NOT NULL,
    "operator" VARCHAR NOT NULL,
    threshold FLOAT8 NOT NULL,
    severity VARCHAR NOT NULL,
    cooldown_seconds INT NOT NULL DEFAULT 300,
    escalation_minutes INT NOT NULL DEFAULT 15,
    enabled BOOL NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY,
    notification_channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb,
    alert_severity_filter JSONB NOT NULL DEFAULT '["warning","critical"]'::jsonb,
    sound_enabled BOOL NOT NULL DEFAULT TRUE,
    theme VARCHAR NOT NULL DEFAULT 'dark',
    default_division_id UUID NULL REFERENCES divisions(id) ON DELETE SET NULL,
    default_period VARCHAR NOT NULL DEFAULT '24h',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tariff_rates (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    peak_rate FLOAT8 NOT NULL,
    off_peak_rate FLOAT8 NOT NULL,
    weekend_rate FLOAT8 NOT NULL,
    peak_hours_start TIME NOT NULL,
    peak_hours_end TIME NOT NULL,
    currency VARCHAR NOT NULL DEFAULT 'USD',
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    is_active BOOL NOT NULL DEFAULT TRUE
);

ALTER TABLE alerts
    ADD CONSTRAINT fk_alerts_rule_id
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL;

CREATE INDEX idx_alerts_active_division ON alerts (division_id) WHERE status = 'active';
CREATE INDEX idx_alerts_status_severity ON alerts (status, severity);
CREATE INDEX idx_alert_rules_enabled_division ON alert_rules (division_id) WHERE enabled = TRUE;
