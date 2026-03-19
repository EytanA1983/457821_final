"""
Shopping Lists API - Ultra Minimal Version
Simple, clean, fast!
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.db.models import User
from app.db.models.shopping_list import ShoppingList, ShoppingItem
from app.schemas.shopping_list import (
    ShoppingListCreate,
    ShoppingListRead,
    ShoppingItemCreate,
    ShoppingItemRead,
)
from app.api.deps import get_current_user
from app.core.logging import logger

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


# ============================================================================
# Shopping Lists
# ============================================================================

@router.get("", response_model=List[ShoppingListRead])
def get_lists(
    room_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all user's shopping lists, optionally filtered by room"""
    query = (
        db.query(ShoppingList)
        .filter(ShoppingList.user_id == user.id)
    )

    # Filter by room if provided
    if room_id is not None:
        query = query.filter(ShoppingList.room_id == room_id)

    lists = query.order_by(ShoppingList.created_at.desc()).all()
    return lists


@router.post("", response_model=ShoppingListRead, status_code=status.HTTP_201_CREATED)
def create_list(
    payload: ShoppingListCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create new shopping list"""
    new_list = ShoppingList(
        user_id=user.id,
        room_id=payload.room_id,
        name=payload.name or "רשימת קניות",
        description=payload.description,
        is_template=payload.is_template,
        reminder_time=payload.reminder_time,
        is_active=True,
    )
    db.add(new_list)
    db.flush()

    # Add initial items (if any)
    for idx, item_data in enumerate(payload.items):
        item = ShoppingItem(
            shopping_list_id=new_list.id,
            name=item_data.name,
            quantity=item_data.quantity,
            category=item_data.category,
            notes=item_data.notes,
            is_fixed=item_data.is_fixed,
            order=item_data.order if item_data.order is not None else idx,
        )
        db.add(item)

    db.commit()
    db.refresh(new_list)

    # Schedule reminder if template has reminder_time
    if payload.is_template and payload.reminder_time:
        try:
            from app.workers.shopping_reminder_tasks import send_shopping_reminder_for_list
            from datetime import datetime

            eta = datetime.fromisoformat(payload.reminder_time.replace('Z', '+00:00'))
            send_shopping_reminder_for_list.apply_async(
                args=[new_list.id],
                eta=eta
            )
            logger.info(f"Scheduled reminder for list {new_list.id} at {eta}")
        except Exception as e:
            logger.warning(f"Failed to schedule reminder: {e}")

    logger.info(f"Shopping list created: {new_list.id}", extra={"user_id": user.id})
    return new_list


@router.get("/{list_id}", response_model=ShoppingListRead)
def get_list(
    list_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get single shopping list"""
    lst = (
        db.query(ShoppingList)
        .filter(
            ShoppingList.id == list_id,
            ShoppingList.user_id == user.id,
        )
        .first()
    )

    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    return lst


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete shopping list"""
    lst = (
        db.query(ShoppingList)
        .filter(
            ShoppingList.id == list_id,
            ShoppingList.user_id == user.id,
        )
        .first()
    )

    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    db.delete(lst)
    db.commit()

    logger.info(f"Shopping list deleted: {list_id}", extra={"user_id": user.id})


# ============================================================================
# Shopping Items
# ============================================================================

@router.post("/{list_id}/items", response_model=ShoppingItemRead)
def add_item(
    list_id: int,
    payload: ShoppingItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add item to shopping list"""
    # Verify list ownership
    lst = (
        db.query(ShoppingList)
        .filter(
            ShoppingList.id == list_id,
            ShoppingList.user_id == user.id,
        )
        .first()
    )

    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    # Create item
    item = ShoppingItem(
        shopping_list_id=lst.id,
        name=payload.name,
        quantity=payload.quantity,
        category=payload.category,
        notes=payload.notes,
        is_fixed=payload.is_fixed,
        order=payload.order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info(f"Item added to list {list_id}", extra={"user_id": user.id})
    return item


@router.patch("/items/{item_id}", response_model=ShoppingItemRead)
def update_item(
    item_id: int,
    payload: dict,  # Flexible update
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update shopping item (usually check/uncheck)"""
    # Get item and verify ownership via list
    item = (
        db.query(ShoppingItem)
        .join(ShoppingList)
        .filter(
            ShoppingItem.id == item_id,
            ShoppingList.user_id == user.id,
        )
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update fields
    for key, val in payload.items():
        if hasattr(item, key):
            setattr(item, key, val)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete shopping item"""
    # Get item and verify ownership via list
    item = (
        db.query(ShoppingItem)
        .join(ShoppingList)
        .filter(
            ShoppingItem.id == item_id,
            ShoppingList.user_id == user.id,
        )
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()

    logger.info(f"Item {item_id} deleted", extra={"user_id": user.id})


@router.post("/{list_id}/complete", response_model=ShoppingListRead)
def complete_list(
    list_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark shopping list as complete"""
    lst = (
        db.query(ShoppingList)
        .filter(
            ShoppingList.id == list_id,
            ShoppingList.user_id == user.id,
        )
        .first()
    )

    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    from datetime import datetime
    lst.completed_at = datetime.utcnow()
    lst.is_active = False

    db.commit()
    db.refresh(lst)

    logger.info(f"Shopping list completed: {list_id}", extra={"user_id": user.id})
    return lst
