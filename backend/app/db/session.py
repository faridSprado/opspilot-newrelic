from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


def sqlite_path_from_url(database_url: str) -> Path:
    if database_url.startswith("sqlite:///"):
        raw = database_url.replace("sqlite:///", "", 1)
        return Path(raw).resolve()
    if database_url.startswith("sqlite://"):
        raw = database_url.replace("sqlite://", "", 1)
        return Path(raw).resolve()
    return Path("opspilot.db").resolve()


class Database:
    def __init__(self, database_url: str) -> None:
        self.path = sqlite_path_from_url(database_url)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.init_schema()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init_schema(self) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS workspace (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS credential_profile (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    label TEXT NOT NULL,
                    account_ids_json TEXT NOT NULL,
                    region TEXT NOT NULL,
                    encrypted_api_key TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS entity_cache (
                    guid TEXT PRIMARY KEY,
                    account_id INTEGER,
                    name TEXT NOT NULL,
                    type TEXT,
                    domain TEXT,
                    language TEXT,
                    alert_severity TEXT,
                    permalink TEXT,
                    tags_json TEXT,
                    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS chat_session (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    selected_entity_guid TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS chat_message (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata_json TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS query_run (
                    id TEXT PRIMARY KEY,
                    session_id TEXT,
                    account_id INTEGER NOT NULL,
                    entity_guid TEXT,
                    nrql TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    chart_spec_json TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS investigation (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    entity_guid TEXT,
                    title TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    findings_json TEXT,
                    charts_json TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                """
            )

    def ensure_workspace(self, name: str = "Default workspace") -> str:
        with self.connect() as conn:
            row = conn.execute("SELECT id FROM workspace ORDER BY created_at LIMIT 1").fetchone()
            if row:
                return str(row["id"])
            workspace_id = str(uuid.uuid4())
            conn.execute("INSERT INTO workspace (id, name) VALUES (?, ?)", (workspace_id, name))
            return workspace_id

    def insert_credential(self, label: str, account_ids: list[int], region: str, encrypted_api_key: str) -> str:
        profile_id = str(uuid.uuid4())
        workspace_id = self.ensure_workspace()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO credential_profile (id, workspace_id, label, account_ids_json, region, encrypted_api_key)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (profile_id, workspace_id, label, json.dumps(account_ids), region, encrypted_api_key),
            )
        return profile_id

    def get_credential(self, profile_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM credential_profile WHERE id = ?", (profile_id,)).fetchone()
        if not row:
            return None
        data = dict(row)
        data["account_ids"] = json.loads(data.pop("account_ids_json"))
        return data

    def delete_credential(self, profile_id: str) -> bool:
        with self.connect() as conn:
            cursor = conn.execute("DELETE FROM credential_profile WHERE id = ?", (profile_id,))
            return cursor.rowcount > 0

    def save_chat_message(self, session_id: str, role: str, content: str, metadata: dict[str, Any] | None = None) -> str:
        message_id = str(uuid.uuid4())
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO chat_message (id, session_id, role, content, metadata_json) VALUES (?, ?, ?, ?, ?)",
                (message_id, session_id, role, content, json.dumps(metadata or {})),
            )
            conn.execute("UPDATE chat_session SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
        return message_id

    def ensure_chat_session(self, session_id: str | None, title: str, workspace_id: str | None = None, selected_entity_guid: str | None = None) -> str:
        if session_id:
            with self.connect() as conn:
                row = conn.execute("SELECT id FROM chat_session WHERE id = ?", (session_id,)).fetchone()
                if row:
                    if selected_entity_guid:
                        conn.execute("UPDATE chat_session SET selected_entity_guid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (selected_entity_guid, session_id))
                    return session_id
        new_id = str(uuid.uuid4())
        workspace = workspace_id or self.ensure_workspace()
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO chat_session (id, workspace_id, title, selected_entity_guid) VALUES (?, ?, ?, ?)",
                (new_id, workspace, title[:120] or "New investigation", selected_entity_guid),
            )
        return new_id

    def list_chat_sessions(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    s.*,
                    COUNT(m.id) AS message_count,
                    (
                        SELECT content
                        FROM chat_message
                        WHERE session_id = s.id
                        ORDER BY created_at DESC, rowid DESC
                        LIMIT 1
                    ) AS last_message
                FROM chat_session s
                LEFT JOIN chat_message m ON m.session_id = s.id
                GROUP BY s.id
                ORDER BY s.updated_at DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def create_chat_session(self, title: str = "Nueva conversación", workspace_id: str | None = None, selected_entity_guid: str | None = None) -> dict[str, Any]:
        session_id = self.ensure_chat_session(None, title, workspace_id=workspace_id, selected_entity_guid=selected_entity_guid)
        return self.get_chat_session(session_id) or {"id": session_id, "title": title}

    def get_chat_session(self, session_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM chat_session WHERE id = ?", (session_id,)).fetchone()
        return dict(row) if row else None

    def update_chat_session_title(self, session_id: str, title: str) -> dict[str, Any] | None:
        clean_title = (title or "").strip()[:120]
        if not clean_title:
            clean_title = "Nueva conversación"
        with self.connect() as conn:
            cursor = conn.execute("UPDATE chat_session SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (clean_title, session_id))
            if cursor.rowcount == 0:
                return None
        return self.get_chat_session(session_id)

    def clear_chat_session(self, session_id: str) -> bool:
        with self.connect() as conn:
            row = conn.execute("SELECT id FROM chat_session WHERE id = ?", (session_id,)).fetchone()
            if not row:
                return False
            conn.execute("DELETE FROM chat_message WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM query_run WHERE session_id = ?", (session_id,))
            conn.execute("UPDATE chat_session SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
            return True

    def get_chat_messages(self, session_id: str) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM chat_message WHERE session_id = ? ORDER BY created_at", (session_id,)).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["metadata"] = json.loads(item.pop("metadata_json") or "{}")
            result.append(item)
        return result

    def delete_chat_session(self, session_id: str) -> bool:
        with self.connect() as conn:
            conn.execute("DELETE FROM chat_message WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM query_run WHERE session_id = ?", (session_id,))
            cursor = conn.execute("DELETE FROM chat_session WHERE id = ?", (session_id,))
            return cursor.rowcount > 0

    def save_query_run(self, session_id: str | None, account_id: int, entity_guid: str | None, nrql: str, result: Any, charts: Any) -> str:
        query_id = str(uuid.uuid4())
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO query_run (id, session_id, account_id, entity_guid, nrql, result_json, chart_spec_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (query_id, session_id, account_id, entity_guid, nrql, json.dumps(result), json.dumps(charts)),
            )
            if session_id:
                conn.execute("UPDATE chat_session SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
        return query_id

    def get_latest_query_run(self, session_id: str | None, entity_guid: str | None = None) -> dict[str, Any] | None:
        """Return the latest saved New Relic query result for a chat session.

        Used by the LLM router when the user says things like "analiza el
        gráfico resultante" or "lo anterior". The payload contains only
        telemetry rows, chart specs and NRQL already visible to the user.
        """
        if not session_id:
            return None
        query = "SELECT * FROM query_run WHERE session_id = ?"
        params: list[Any] = [session_id]
        if entity_guid:
            query += " AND (entity_guid = ? OR entity_guid IS NULL)"
            params.append(entity_guid)
        query += " ORDER BY created_at DESC, rowid DESC LIMIT 1"
        with self.connect() as conn:
            row = conn.execute(query, params).fetchone()
        if not row:
            return None
        item = dict(row)
        item["rows"] = json.loads(item.pop("result_json") or "[]")
        item["visualizations"] = json.loads(item.pop("chart_spec_json") or "[]")
        return item
