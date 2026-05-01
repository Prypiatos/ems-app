-- ── Seed: Divisions ──────────────────────────────────────────────────────────
INSERT INTO divisions (id, name, parent_id, floor, building) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Engineering',  NULL,                                   '3',    'Block A'),
    ('00000000-0000-0000-0000-000000000002', 'Operations',   NULL,                                   '1',    'Block B'),
    ('00000000-0000-0000-0000-000000000003', 'Research',     NULL,                                   '4',    'Block A'),
    ('00000000-0000-0000-0000-000000000004', 'HR & Admin',   NULL,                                   '2',    'Block C'),
    ('00000000-0000-0000-0000-000000000005', 'IT',           '00000000-0000-0000-0000-000000000001', 'B1',   'Block A');
 
-- ── Seed: Devices (20) ────────────────────────────────────────────────────────
INSERT INTO devices (name, division_id, protocol, status) VALUES
    -- Engineering (6 devices)
    ('ENG-Meter-01',    '00000000-0000-0000-0000-000000000001', 'MODBUS',   'online'),
    ('ENG-Meter-02',    '00000000-0000-0000-0000-000000000001', 'MODBUS',   'online'),
    ('ENG-Sensor-01',   '00000000-0000-0000-0000-000000000001', 'MQTT',     'online'),
    ('ENG-Sensor-02',   '00000000-0000-0000-0000-000000000001', 'MQTT',     'degraded'),
    ('ENG-Panel-01',    '00000000-0000-0000-0000-000000000001', 'BACNET',   'online'),
    ('ENG-Panel-02',    '00000000-0000-0000-0000-000000000001', 'BACNET',   'offline'),
 
    -- Operations (5 devices)
    ('OPS-Meter-01',    '00000000-0000-0000-0000-000000000002', 'MODBUS',   'online'),
    ('OPS-Meter-02',    '00000000-0000-0000-0000-000000000002', 'MODBUS',   'online'),
    ('OPS-Sensor-01',   '00000000-0000-0000-0000-000000000002', 'MQTT',     'online'),
    ('OPS-Panel-01',    '00000000-0000-0000-0000-000000000002', 'BACNET',   'online'),
    ('OPS-Panel-02',    '00000000-0000-0000-0000-000000000002', 'BACNET',   'degraded'),
 
    -- Research (4 devices)
    ('RES-Meter-01',    '00000000-0000-0000-0000-000000000003', 'MODBUS',   'online'),
    ('RES-Sensor-01',   '00000000-0000-0000-0000-000000000003', 'MQTT',     'online'),
    ('RES-Sensor-02',   '00000000-0000-0000-0000-000000000003', 'MQTT',     'online'),
    ('RES-Panel-01',    '00000000-0000-0000-0000-000000000003', 'BACNET',   'offline'),
 
    -- HR & Admin (3 devices)
    ('HR-Meter-01',     '00000000-0000-0000-0000-000000000004', 'MODBUS',   'online'),
    ('HR-Sensor-01',    '00000000-0000-0000-0000-000000000004', 'MQTT',     'online'),
    ('HR-Panel-01',     '00000000-0000-0000-0000-000000000004', 'BACNET',   'online'),
 
    -- IT (2 devices)
    ('IT-Meter-01',     '00000000-0000-0000-0000-000000000005', 'MODBUS',   'online'),
    ('IT-Sensor-01',    '00000000-0000-0000-0000-000000000005', 'MQTT',     'online');
 
-- ── Seed: Tariff Rate (1 active) ──────────────────────────────────────────────
INSERT INTO tariff_rates (name, peak_rate, off_peak_rate, weekend_rate, peak_hours_start, peak_hours_end, currency, effective_from, is_active) VALUES
    ('Standard 2025', 0.18, 0.09, 0.07, '08:00', '20:00', 'USD', '2025-01-01', true);
