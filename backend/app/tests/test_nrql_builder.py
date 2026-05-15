import pytest

from app.security import assert_safe_nrql, escape_nrql_string
from app.services.nrql_builder import NrqlBuilder


def test_nrql_builder_escapes_app_name():
    plan = NrqlBuilder.build("throughput", app_name="checkout-api'prod", since="3 hours ago")
    assert "checkout-api\\'prod" in plan.nrql
    assert plan.nrql.startswith("SELECT")


def test_assert_safe_nrql_blocks_mutation_keyword():
    with pytest.raises(ValueError):
        assert_safe_nrql("mutation { actor { account(id: 1) { nrql(query: \"SELECT 1\") } } }")


def test_assert_safe_nrql_allows_show():
    assert assert_safe_nrql("SHOW EVENT TYPES") == "SHOW EVENT TYPES"


def test_escape_nrql_string_backslash_and_quote():
    assert escape_nrql_string("a\\b'c") == "a\\\\b\\'c"


def test_time_bounds_floor_to_previous_five_minutes():
    from datetime import datetime, timezone

    since, until = NrqlBuilder.normalized_time_bounds(
        "3 hours ago",
        None,
        now=datetime(2026, 5, 14, 21, 38, 23, tzinfo=timezone.utc),
    )
    assert until == "'2026-05-14T21:35:00Z'"
    assert since == "'2026-05-14T18:35:00Z'"


def test_custom_time_bounds_floor_to_previous_five_minutes():
    since, until = NrqlBuilder.normalized_time_bounds(
        "'2026-05-14T20:12:44Z'",
        "'2026-05-14T21:38:23Z'",
    )
    assert since == "'2026-05-14T20:10:00Z'"
    assert until == "'2026-05-14T21:35:00Z'"


def test_new_tool_intents_generate_safe_read_only_nrql():
    intents = [
        "key_transactions",
        "error_messages",
        "external_failures",
        "database_operations",
        "logs_errors",
        "trace_slow_spans",
        "cpu_memory",
        "hosts_instances",
        "current_vs_previous",
        "keyset",
    ]
    for intent in intents:
        plan = NrqlBuilder.build(intent, entity_guid="abc", since="3 hours ago")
        assert plan.nrql.startswith(("SELECT", "SHOW"))
        assert "abc" in plan.nrql


def test_timeseries_interval_adapts_for_24_hour_ranges():
    plan = NrqlBuilder.build(
        "throughput",
        entity_guid="guid-1",
        since="'2026-05-14T00:00:00Z'",
        until="'2026-05-15T00:00:00Z'",
        step="1 minute",
    )
    assert "TIMESERIES 5 minutes" in plan.nrql


def test_timeseries_interval_adapts_for_7_day_ranges():
    plan = NrqlBuilder.build(
        "response_time",
        entity_guid="guid-1",
        since="'2026-05-08T00:00:00Z'",
        until="'2026-05-15T00:00:00Z'",
        step="1 minute",
    )
    assert "TIMESERIES 1 hour" in plan.nrql
