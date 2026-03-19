"""
Shopping List Service Layer
Business logic for shopping lists and items
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer
from typing import List, Optional
from datetime import datetime

from app.db.models.shopping_list import ShoppingList, ShoppingItem
from app.db.models.user import User
from app.schemas.shopping_list import (
    ShoppingListCreate,
    ShoppingListUpdate,
    ShoppingItemCreate,
    ShoppingItemUpdate,
)
from app.core.logging import logger


# ============================================================================
# Shopping List Operations
# ============================================================================

def create_shopping_list(
    db: Session,
    user_id: int,
    payload: ShoppingListCreate
) -> ShoppingList:
    """
    Create a new shopping list with items.

    Args:
        db: Database session
        user_id: Owner user ID
        payload: Shopping list data with items

    Returns:
        Created ShoppingList with items
    """
    # Create shopping list
    db_list = ShoppingList(
        user_id=user_id,
        name=payload.name,
        description=payload.description,
        is_template=payload.is_template,
        reminder_time=payload.reminder_time,
    )
    db.add(db_list)
    db.flush()  # Get ID before adding items

    # Add items
    for idx, item in enumerate(payload.items):
        db_item = ShoppingItem(
            shopping_list_id=db_list.id,
            name=item.name,
            quantity=item.quantity,
            category=item.category,
            notes=item.notes,
            is_fixed=item.is_fixed,
            order=item.order if item.order else idx,
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_list)

    logger.info(f"Shopping list created: {db_list.id}", extra={
        "user_id": user_id,
        "list_name": db_list.name,
        "item_count": len(payload.items),
    })

    return db_list


def get_user_lists(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    templates_only: bool = False
) -> List[ShoppingList]:
    """
    Get all shopping lists for a user.

    Args:
        db: Database session
        user_id: Owner user ID
        skip: Number of records to skip
        limit: Maximum number of records to return
        active_only: Filter only active lists
        templates_only: Filter only templates

    Returns:
        List of ShoppingList objects
    """
    query = db.query(ShoppingList).filter(
        ShoppingList.user_id == user_id
    )

    if active_only:
        query = query.filter(ShoppingList.is_active == True)

    if templates_only:
        query = query.filter(ShoppingList.is_template == True)

    query = query.order_by(ShoppingList.created_at.desc())
    query = query.offset(skip).limit(limit)

    return query.all()


def get_shopping_list(
    db: Session,
    list_id: int,
    user_id: int
) -> Optional[ShoppingList]:
    """
    Get a specific shopping list by ID.

    Args:
        db: Database session
        list_id: Shopping list ID
        user_id: Owner user ID (for authorization)

    Returns:
        ShoppingList or None if not found
    """
    return db.query(ShoppingList).filter(
        ShoppingList.id == list_id,
        ShoppingList.user_id == user_id
    ).first()


def get_last_list(
    db: Session,
    user_id: int,
    exclude_templates: bool = True
) -> Optional[ShoppingList]:
    """
    Get the most recent shopping list for a user.

    Args:
        db: Database session
        user_id: Owner user ID
        exclude_templates: Exclude template lists

    Returns:
        Most recent ShoppingList or None
    """
    query = db.query(ShoppingList).filter(
        ShoppingList.user_id == user_id
    )

    if exclude_templates:
        query = query.filter(ShoppingList.is_template == False)

    return query.order_by(ShoppingList.created_at.desc()).first()


def update_shopping_list(
    db: Session,
    list_id: int,
    user_id: int,
    payload: ShoppingListUpdate
) -> Optional[ShoppingList]:
    """
    Update a shopping list.

    Args:
        db: Database session
        list_id: Shopping list ID
        user_id: Owner user ID (for authorization)
        payload: Update data

    Returns:
        Updated ShoppingList or None if not found
    """
    db_list = get_shopping_list(db, list_id, user_id)
    if not db_list:
        return None

    # Update fields
    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_list, field, value)

    db_list.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_list)

    return db_list


def delete_shopping_list(
    db: Session,
    list_id: int,
    user_id: int
) -> bool:
    """
    Delete a shopping list.

    Args:
        db: Database session
        list_id: Shopping list ID
        user_id: Owner user ID (for authorization)

    Returns:
        True if deleted, False if not found
    """
    db_list = get_shopping_list(db, list_id, user_id)
    if not db_list:
        return False

    db.delete(db_list)
    db.commit()

    logger.info(f"Shopping list deleted: {list_id}", extra={"user_id": user_id})
    return True


def clone_shopping_list(
    db: Session,
    source_id: int,
    user_id: int,
    new_name: Optional[str] = None
) -> Optional[ShoppingList]:
    """
    Clone an existing shopping list.

    Args:
        db: Database session
        source_id: Source shopping list ID
        user_id: Owner user ID (for authorization)
        new_name: New name for cloned list (optional)

    Returns:
        New ShoppingList or None if source not found
    """
    source = get_shopping_list(db, source_id, user_id)
    if not source:
        return None

    # Create new list
    new_list = ShoppingList(
        user_id=user_id,
        name=new_name or f"{source.name} (עותק)",
        description=source.description,
        is_template=False,  # Cloned lists are not templates
        reminder_time=None,  # Don't copy reminder
    )
    db.add(new_list)
    db.flush()

    # Clone items
    for item in source.items:
        new_item = ShoppingItem(
            shopping_list_id=new_list.id,
            name=item.name,
            quantity=item.quantity,
            category=item.category,
            notes=item.notes,
            is_fixed=item.is_fixed,
            order=item.order,
            is_checked=False,  # Reset checked status
        )
        db.add(new_item)

    db.commit()
    db.refresh(new_list)

    logger.info(f"Shopping list cloned: {source_id} -> {new_list.id}", extra={
        "user_id": user_id
    })

    return new_list


def complete_shopping_list(
    db: Session,
    list_id: int,
    user_id: int,
    completed: bool = True
) -> Optional[ShoppingList]:
    """
    Mark a shopping list as complete/incomplete.

    Args:
        db: Database session
        list_id: Shopping list ID
        user_id: Owner user ID (for authorization)
        completed: True to mark complete, False to reopen

    Returns:
        Updated ShoppingList or None if not found
    """
    db_list = get_shopping_list(db, list_id, user_id)
    if not db_list:
        return None

    if completed:
        db_list.completed_at = datetime.utcnow()
        db_list.is_active = False
    else:
        db_list.completed_at = None
        db_list.is_active = True

    db_list.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_list)

    return db_list


# ============================================================================
# Shopping Item Operations
# ============================================================================

def add_item_to_list(
    db: Session,
    list_id: int,
    user_id: int,
    payload: ShoppingItemCreate
) -> Optional[ShoppingItem]:
    """
    Add a new item to a shopping list.

    Args:
        db: Database session
        list_id: Shopping list ID
        user_id: Owner user ID (for authorization)
        payload: Item data

    Returns:
        Created ShoppingItem or None if list not found
    """
    # Verify list ownership
    db_list = get_shopping_list(db, list_id, user_id)
    if not db_list:
        return None

    # Create item
    item = ShoppingItem(
        shopping_list_id=list_id,
        name=payload.name,
        quantity=payload.quantity,
        category=payload.category,
        notes=payload.notes,
        is_fixed=payload.is_fixed,
        order=payload.order,
    )
    db.add(item)

    # Update list timestamp
    db_list.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)

    return item


def update_shopping_item(
    db: Session,
    list_id: int,
    item_id: int,
    user_id: int,
    payload: ShoppingItemUpdate
) -> Optional[ShoppingItem]:
    """
    Update a shopping item.

    Args:
        db: Database session
        list_id: Shopping list ID
        item_id: Item ID
        user_id: Owner user ID (for authorization)
        payload: Update data

    Returns:
        Updated ShoppingItem or None if not found
    """
    # Verify list ownership
    db_list = get_shopping_list(db, list_id, user_id)
    if not db_list:
        return None

    # Get item
    item = db.query(ShoppingItem).filter(
        ShoppingItem.id == item_id,
        ShoppingItem.shopping_list_id == list_id
    ).first()

    if not item:
        return None

    # Update fields
    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    # If checked status changed, update timestamp
    if 'is_checked' in update_data:
        item.checked_at = datetime.utcnow() if update_data['is_checked'] else None

    # Update list timestamp
    db_list.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)

    return item


def delete_shopping_item(
    db: Session,
    list_id: int,
    item_id: int,
    user_id: int
) -> bool:
    """
    Delete a shopping item.

    Args:
        db: Database session
        list_id: Shopping list ID
        item_id: Item ID
        user_id: Owner user ID (for authorization)

    Returns:
        True if deleted, False if not found
    """
    # Verify list ownership
    db_list = get_shopping_list(db, list_id, user_id)
    if not db_list:
        return False

    # Get item
    item = db.query(ShoppingItem).filter(
        ShoppingItem.id == item_id,
        ShoppingItem.shopping_list_id == list_id
    ).first()

    if not item:
        return False

    db.delete(item)

    # Update list timestamp
    db_list.updated_at = datetime.utcnow()

    db.commit()

    return True


# ============================================================================
# Statistics & Analytics
# ============================================================================

def get_list_statistics(
    db: Session,
    list_id: int,
    user_id: int
) -> Optional[dict]:
    """
    Get statistics for a shopping list.

    Args:
        db: Database session
        list_id: Shopping list ID
        user_id: Owner user ID (for authorization)

    Returns:
        Dictionary with statistics or None if not found
    """
    db_list = get_shopping_list(db, list_id, user_id)
    if not db_list:
        return None

    total_items = len(db_list.items)
    checked_items = sum(1 for item in db_list.items if item.is_checked)
    fixed_items = sum(1 for item in db_list.items if item.is_fixed)

    # Count by category
    categories = {}
    for item in db_list.items:
        cat = item.category or "ללא קטגוריה"
        if cat not in categories:
            categories[cat] = {"total": 0, "checked": 0}
        categories[cat]["total"] += 1
        if item.is_checked:
            categories[cat]["checked"] += 1

    return {
        "total_items": total_items,
        "checked_items": checked_items,
        "fixed_items": fixed_items,
        "progress_percentage": (checked_items / total_items * 100) if total_items > 0 else 0,
        "categories": categories,
    }
