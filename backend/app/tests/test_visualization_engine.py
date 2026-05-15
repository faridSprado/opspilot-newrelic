from app.services.visualization_engine import VisualizationEngine, detect_time_key, metric_keys


def test_acceptance_timestamp_columns_are_never_y_series():
    rows = [
        {
            "beginTimeSeconds": 1710000000,
            "endTimeSeconds": 1710000060,
            "Response Time ms": 530,
            "Throughput RPM": 180,
        }
    ]
    specs = VisualizationEngine().build_visualizations(rows, nrql="SELECT ...", title="Acceptance")
    chart = specs[0]

    assert chart["x"]["key"] in {"beginTimeSeconds", "endTimeSeconds"}
    y_keys = {field["key"] for field in chart["y"]}
    assert y_keys == {"Response Time ms", "Throughput RPM"}
    assert "beginTimeSeconds" not in y_keys
    assert "endTimeSeconds" not in y_keys
    assert all(series["key"] not in {"beginTimeSeconds", "endTimeSeconds"} for series in chart["series"])


def test_detect_time_key_prefers_begin_time():
    rows = [{"endTimeSeconds": 2, "beginTimeSeconds": 1, "metric": 3}]
    assert detect_time_key(rows) == "beginTimeSeconds"


def test_ids_are_excluded_from_metrics():
    rows = [{"timestamp": 1710000000, "accountId": 123, "entityGuid": "abc", "Errors": 4}]
    assert metric_keys(rows, x_key="timestamp") == ["Errors"]


def test_dual_axis_for_different_units():
    rows = [{"timestamp": 1710000000, "Response Time ms": 530, "Throughput RPM": 180}]
    chart = VisualizationEngine().build_visualizations(rows, title="Dual axis")[0]
    axes = {field["key"]: field["axis"] for field in chart["y"]}
    assert axes["Response Time ms"] == "left"
    assert axes["Throughput RPM"] == "right"
    assert chart["meta"]["dual_axis"] is True


def test_empty_rows_return_table_empty_state():
    chart = VisualizationEngine().build_visualizations([], nrql="SELECT count(*) FROM Transaction")[0]
    assert chart["type"] == "table"
    assert chart["rows"] == []
    assert "no devolvió filas" in chart["subtitle"].lower()
