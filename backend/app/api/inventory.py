from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import InventoryArea, InventoryItem, User
from app.db.session import get_db
from app.schemas.inventory import (
    InventoryAreaCreate,
    InventoryAreaRead,
    InventoryAreaUpdate,
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemUpdate,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/areas", response_model=List[InventoryAreaRead])
@router.get("/areas/", response_model=List[InventoryAreaRead])  # Also handle trailing slash
def list_areas(
    room_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(InventoryArea).filter(InventoryArea.user_id == user.id)
    if room_id is not None:
        query = query.filter(InventoryArea.room_id == room_id)
    return query.order_by(InventoryArea.updated_at.desc()).all()


@router.post("/areas", response_model=InventoryAreaRead, status_code=status.HTTP_201_CREATED)
@router.post("/areas/", response_model=InventoryAreaRead, status_code=status.HTTP_201_CREATED)  # Also handle trailing slash
def create_area(
    payload: InventoryAreaCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    area = InventoryArea(user_id=user.id, **payload.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.patch("/areas/{area_id}", response_model=InventoryAreaRead)
def update_area(
    area_id: int,
    payload: InventoryAreaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    area = db.query(InventoryArea).filter(InventoryArea.id == area_id, InventoryArea.user_id == user.id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(area, key, value)
    db.commit()
    db.refresh(area)
    return area


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    area = db.query(InventoryArea).filter(InventoryArea.id == area_id, InventoryArea.user_id == user.id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    db.delete(area)
    db.commit()
    return None


@router.get("/items", response_model=List[InventoryItemRead])
@router.get("/items/", response_model=List[InventoryItemRead])  # Also handle trailing slash
def list_items(
    area_id: Optional[int] = None,
    room_id: Optional[int] = None,
    donated_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(InventoryItem).filter(InventoryItem.user_id == user.id)
    if area_id is not None:
        query = query.filter(InventoryItem.area_id == area_id)
    if room_id is not None:
        query = query.filter(InventoryItem.room_id == room_id)
    if donated_only:
        query = query.filter(InventoryItem.is_donated.is_(True))
    return query.order_by(InventoryItem.updated_at.desc()).all()


@router.post("/items", response_model=InventoryItemRead, status_code=status.HTTP_201_CREATED)
@router.post("/items/", response_model=InventoryItemRead, status_code=status.HTTP_201_CREATED)  # Also handle trailing slash
def create_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    area = db.query(InventoryArea).filter(
        InventoryArea.id == payload.area_id,
        InventoryArea.user_id == user.id,
    ).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")

    item = InventoryItem(user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=InventoryItemRead)
def update_item(
    item_id: int,
    payload: InventoryItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    data = payload.model_dump(exclude_unset=True)
    if "area_id" in data:
        area = db.query(InventoryArea).filter(
            InventoryArea.id == data["area_id"],
            InventoryArea.user_id == user.id,
        ).first()
        if not area:
            raise HTTPException(status_code=404, detail="Area not found")

    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return None
