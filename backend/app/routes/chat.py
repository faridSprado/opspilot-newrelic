from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.db.session import Database
from app.dependencies import get_db, get_optional_new_relic_tools, get_profile_id
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.agent_service import AgentService

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatSessionCreate(BaseModel):
    title: str = Field(default="Nueva conversación", max_length=120)
    selected_entity_guid: str | None = None


class ChatSessionUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, profile_id: str | None = Depends(get_profile_id), db: Database = Depends(get_db)):
    service = AgentService(get_optional_new_relic_tools(profile_id), db=db)
    response = await service.answer(payload)
    if payload.stream:
        return StreamingResponse(service.sse_events(response), media_type="text/event-stream")
    return response


@router.get("/sessions")
async def list_sessions(db: Database = Depends(get_db)) -> dict:
    return {"ok": True, "sessions": db.list_chat_sessions()}


@router.post("/sessions")
async def create_session(payload: ChatSessionCreate, db: Database = Depends(get_db)) -> dict:
    session = db.create_chat_session(title=payload.title, selected_entity_guid=payload.selected_entity_guid)
    return {"ok": True, "session": session}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: Database = Depends(get_db)) -> dict:
    session = db.get_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return {"ok": True, "session": session, "messages": db.get_chat_messages(session_id)}


@router.patch("/sessions/{session_id}")
async def rename_session(session_id: str, payload: ChatSessionUpdate, db: Database = Depends(get_db)) -> dict:
    session = db.update_chat_session_title(session_id, payload.title)
    if not session:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return {"ok": True, "session": session}


@router.delete("/sessions/{session_id}/messages")
async def clear_session(session_id: str, db: Database = Depends(get_db)) -> dict:
    ok = db.clear_chat_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return {"ok": True}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: Database = Depends(get_db)) -> dict:
    return {"ok": db.delete_chat_session(session_id)}
