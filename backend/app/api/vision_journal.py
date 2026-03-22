"""Vision journal / inspiration board — per-user text and image entries."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User, VisionJournalEntry
from app.db.session import get_db
from app.schemas.vision_journal import (
    VisionJournalEntryCreate,
    VisionJournalEntryRead,
    VisionJournalImageUploadResponse,
)

logger = logging.getLogger("app")

_STATIC_ROOT = Path(__file__).resolve().parents[2] / "static"
_UPLOADS_ROOT = _STATIC_ROOT / "uploads" / "vision-journal"
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

router = APIRouter(prefix="/api/vision-journal", tags=["vision-journal"])


def _validate_create_payload(payload: VisionJournalEntryCreate) -> None:
    if payload.entry_type == "text":
        if not payload.text_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="text_content is required for text entries.",
            )
    else:
        if not payload.image_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="image_url is required for image entries (upload first).",
            )


@router.get("/items", response_model=list[VisionJournalEntryRead])
def list_vision_journal_items(
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lim = max(1, min(limit, 500))
    rows = (
        db.query(VisionJournalEntry)
        .filter(VisionJournalEntry.user_id == user.id)
        .order_by(VisionJournalEntry.created_at.desc())
        .limit(lim)
        .all()
    )
    return rows


@router.post("/items", response_model=VisionJournalEntryRead, status_code=status.HTTP_201_CREATED)
def create_vision_journal_item(
    payload: VisionJournalEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_create_payload(payload)
    if payload.entry_type == "text":
        row = VisionJournalEntry(
            user_id=user.id,
            entry_type="text",
            text_content=payload.text_content,
            image_url=None,
            caption=payload.caption,
            position=payload.position,
        )
    else:
        row = VisionJournalEntry(
            user_id=user.id,
            entry_type="image",
            text_content=None,
            image_url=payload.image_url,
            caption=payload.caption,
            position=payload.position,
        )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vision_journal_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(VisionJournalEntry)
        .filter(VisionJournalEntry.id == item_id, VisionJournalEntry.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    db.delete(row)
    db.commit()
    return None


@router.post("/upload-image", response_model=VisionJournalImageUploadResponse)
async def upload_vision_journal_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Store image under static/uploads/vision-journal/{user_id}/ — same pattern as inventory."""
    raw_ct = (file.content_type or "").split(";")[0].strip().lower()
    ext = _ALLOWED_IMAGE_TYPES.get(raw_ct)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Use JPEG, PNG, WebP, or GIF.",
        )

    user_dir = _UPLOADS_ROOT / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    name = f"{uuid4().hex}{ext}"
    dest = user_dir / name

    size = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > _MAX_IMAGE_BYTES:
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="File too large (max 5 MB).",
                    )
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        dest.unlink(missing_ok=True)
        logger.exception("vision journal upload failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save upload.",
        ) from e

    public_path = f"/static/uploads/vision-journal/{user.id}/{name}"
    return VisionJournalImageUploadResponse(url=public_path)
