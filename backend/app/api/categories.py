from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.api.deps import get_current_user
from app.api.deps_audit import get_audit_context
from app.services.audit import audit_service, AuditAction
from app.db.models import User
from app.core.cache import invalidate_user_cache, cache_get, cache_set, make_cache_key, CACHE_TTL_MEDIUM

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("", response_model=List[CategoryRead])
def read_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """List categories with Redis caching (TTL: 1 minute)"""
    # Try cache first
    cache_key = make_cache_key("categories", user.id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # Query database
    categories = (
        db.query(Category)
        .filter(Category.user_id == user.id)
        .order_by(Category.position.asc(), Category.id.asc())
        .all()
    )

    # Cache the result
    cache_data = []
    for c in categories:
        cat_dict = {
            "id": c.id,
            "name": c.name,
            "icon": c.icon,
            "user_id": c.user_id,
            "position": c.position if hasattr(c, 'position') else None,
        }
        cache_data.append(cat_dict)

    cache_set(cache_key, cache_data, CACHE_TTL_MEDIUM)

    return categories

@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    request: Request,
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    cat = Category(**cat_in.dict(), user_id=user.id)
    db.add(cat)
    db.flush()  # Flush to get the ID

    # Create audit log
    new_values = cat_in.dict()
    audit_service.create_audit_log(
        session=db,
        instance=cat,
        action=AuditAction.CREATE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        new_values=new_values,
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.commit()
    db.refresh(cat)

    # Invalidate categories cache
    invalidate_user_cache(user.id, ["categories"])

    return cat

@router.get("/{cat_id}", response_model=CategoryRead)
def get_category(cat_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="קטגוריה לא קיימת")
    return cat

@router.put("/{cat_id}", response_model=CategoryRead)
def update_category(
    request: Request,
    cat_id: int,
    cat_in: CategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="קטגוריה לא קיימת")

    # Get changed fields before update
    changed_fields = audit_service.get_changed_fields(cat, db)

    # Update category
    for key, value in cat_in.dict(exclude_unset=True).items():
        setattr(cat, key, value)

    db.flush()  # Flush to get updated values

    # Get new changed fields after update
    changed_fields = audit_service.get_changed_fields(cat, db)

    if changed_fields:
        # Prepare old and new values
        old_values = {field: data["old"] for field, data in changed_fields.items()}
        new_values = {field: data["new"] for field, data in changed_fields.items()}

        # Create audit log
        audit_service.create_audit_log(
            session=db,
            instance=cat,
            action=AuditAction.UPDATE,
            user_id=audit_context["user_id"],
            user_email=audit_context["user_email"],
            old_values=old_values,
            new_values=new_values,
            changed_fields=changed_fields,
            ip_address=audit_context["ip_address"],
            user_agent=audit_context["user_agent"],
        )

    db.commit()
    db.refresh(cat)

    # Invalidate categories cache
    invalidate_user_cache(user.id, ["categories"])

    return cat

@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    request: Request,
    cat_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="קטגוריה לא קיימת")

    # Create audit log before delete
    old_values = {
        "name": cat.name,
        "icon": cat.icon,
        "user_id": cat.user_id,
        "position": cat.position if hasattr(cat, 'position') else None,
    }
    audit_service.create_audit_log(
        session=db,
        instance=cat,
        action=AuditAction.DELETE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        old_values=old_values,
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.delete(cat)
    db.commit()

    # Invalidate categories cache
    invalidate_user_cache(user.id, ["categories"])

    return None
