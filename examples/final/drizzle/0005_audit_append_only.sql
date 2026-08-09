CREATE TRIGGER IF NOT EXISTS `domain_events_append_only_update`
BEFORE UPDATE ON `domain_events`
BEGIN
	SELECT RAISE(ABORT, 'domain_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `domain_events_append_only_delete`
BEFORE DELETE ON `domain_events`
BEGIN
	SELECT RAISE(ABORT, 'domain_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `domain_event_payloads_append_only_update`
BEFORE UPDATE ON `domain_event_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_payloads is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `domain_event_payloads_append_only_delete`
BEFORE DELETE ON `domain_event_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_payloads is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `domain_event_sensitive_payloads_append_only_update`
BEFORE UPDATE ON `domain_event_sensitive_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_sensitive_payloads is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `domain_event_sensitive_payloads_append_only_delete`
BEFORE DELETE ON `domain_event_sensitive_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_sensitive_payloads is append-only');
END;
