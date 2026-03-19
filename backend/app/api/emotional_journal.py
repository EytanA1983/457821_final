from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import EmotionalJournalEntry, User
from app.db.session import get_db
from app.schemas.emotional_journal import EmotionalJournalCreate, EmotionalJournalRead

router = APIRouter(prefix="/api/emotional-journal", tags=["emotional-journal"])


@router.get("", response_model=List[EmotionalJournalRead])
def list_entries(
    limit: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    safe_limit = max(1, min(limit, 200))
    return (
        db.query(EmotionalJournalEntry)
        .filter(EmotionalJournalEntry.user_id == user.id)
        .order_by(EmotionalJournalEntry.created_at.desc())
        .limit(safe_limit)
        .all()
    )


@router.post("", response_model=EmotionalJournalRead, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: EmotionalJournalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = EmotionalJournalEntry(
        user_id=user.id,
        item_name=payload.item_name.strip(),
        why_keep=(payload.why_keep or "").strip(),
        spark_joy=payload.spark_joy,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = (
        db.query(EmotionalJournalEntry)
        .filter(EmotionalJournalEntry.id == entry_id, EmotionalJournalEntry.user_id == user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return None
