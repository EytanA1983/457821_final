"""
API endpoints for room sharing
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.api.deps import get_current_user
from app.api.deps_audit import get_audit_context
from app.db.models import User, Room, RoomShare
from app.schemas.sharing import (
    RoomShareCreate,
    RoomShareByEmailCreate,
    RoomShareResponse,
    RoomShareUpdate,
    RoomWithShares,
)
from app.services.permissions import permission_service, Permission
from app.core.logging import logger, log_api_call

router = APIRouter(prefix="/sharing", tags=["sharing"])


@router.post("/rooms/{room_id}/share-by-email", response_model=RoomShareResponse, status_code=status.HTTP_201_CREATED)
def share_room_by_email(
    request: Request,
    room_id: int,
    share_data: RoomShareByEmailCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    audit_context: dict = Depends(get_audit_context),
):
    """Share room by user email (household invitation shortcut)."""
    target_user = db.query(User).filter(User.email == share_data.email.strip().lower()).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email was not found",
        )

    share = permission_service.share_room(
        db=db,
        room_id=room_id,
        shared_with_user_id=target_user.id,
        permission=share_data.permission,
        shared_by_user_id=current_user.id,
    )

    return RoomShareResponse(
        id=share.id,
        room_id=share.room_id,
        user_id=share.user_id,
        user_email=target_user.email,
        user_name=target_user.full_name,
        permission=share.permission,
        shared_by=share.shared_by,
        created_at=share.created_at,
    )


@router.post("/rooms/{room_id}/share", response_model=RoomShareResponse, status_code=status.HTTP_201_CREATED)
def share_room(
    request: Request,
    room_id: int,
    share_data: RoomShareCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    audit_context: dict = Depends(get_audit_context),
):
    """
    שתף חדר עם משתמש אחר
    """
    log_api_call(f"/api/sharing/rooms/{room_id}/share", "POST", user_id=current_user.id)

    try:
        share = permission_service.share_room(
            db=db,
            room_id=room_id,
            shared_with_user_id=share_data.user_id,
            permission=share_data.permission,
            shared_by_user_id=current_user.id,
        )

        # Get user info for response
        shared_user = db.query(User).filter(User.id == share_data.user_id).first()

        logger.info(
            "Room shared",
            extra={
                "room_id": room_id,
                "shared_with": share_data.user_id,
                "permission": share_data.permission.value,
                "shared_by": current_user.id,
            },
        )

        return RoomShareResponse(
            id=share.id,
            room_id=share.room_id,
            user_id=share.user_id,
            user_email=shared_user.email if shared_user else None,
            user_name=shared_user.full_name if shared_user else None,
            permission=share.permission,
            shared_by=share.shared_by,
            created_at=share.created_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.get("/rooms/{room_id}/shares", response_model=List[RoomShareResponse])
def get_room_shares(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל את כל השיתופים של חדר
    """
    # Check if user can access room
    if not permission_service.can_access_room(db, current_user.id, room_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this room",
        )

    shares = permission_service.get_room_shares(db, room_id)

    # Get user info for each share
    result = []
    for share in shares:
        user = db.query(User).filter(User.id == share.user_id).first()
        result.append(
            RoomShareResponse(
                id=share.id,
                room_id=share.room_id,
                user_id=share.user_id,
                user_email=user.email if user else None,
                user_name=user.full_name if user else None,
                permission=share.permission,
                shared_by=share.shared_by,
                created_at=share.created_at,
            )
        )

    return result


@router.put("/rooms/{room_id}/shares/{share_id}", response_model=RoomShareResponse)
def update_room_share(
    request: Request,
    room_id: int,
    share_id: int,
    share_update: RoomShareUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    עדכן הרשאות שיתוף חדר
    """
    # Check if user is room owner
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if room.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room owner can update shares",
        )

    # Get share
    share = db.query(RoomShare).filter(
        RoomShare.id == share_id,
        RoomShare.room_id == room_id,
    ).first()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    # Update permission
    share.permission = share_update.permission.value
    db.commit()
    db.refresh(share)

    # Get user info
    user = db.query(User).filter(User.id == share.user_id).first()

    logger.info(
        "Room share updated",
        extra={
            "room_id": room_id,
            "share_id": share_id,
            "new_permission": share_update.permission.value,
        },
    )

    return RoomShareResponse(
        id=share.id,
        room_id=share.room_id,
        user_id=share.user_id,
        user_email=user.email if user else None,
        user_name=user.full_name if user else None,
        permission=share.permission,
        shared_by=share.shared_by,
        created_at=share.created_at,
    )


@router.delete("/rooms/{room_id}/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def unshare_room(
    request: Request,
    room_id: int,
    share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    הסר שיתוף חדר
    """
    # Get share
    share = db.query(RoomShare).filter(
        RoomShare.id == share_id,
        RoomShare.room_id == room_id,
    ).first()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    # Check if user is room owner
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room or room.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room owner can unshare",
        )

    # Unshare
    success = permission_service.unshare_room(
        db, room_id, share.user_id, current_user.id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to unshare room",
        )

    logger.info(
        "Room unshared",
        extra={"room_id": room_id, "share_id": share_id, "user_id": share.user_id},
    )

    return None


@router.get("/rooms/{room_id}/permission")
def get_room_permission(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל את הרשאת המשתמש בחדר
    """
    permission = permission_service.get_room_permission(db, current_user.id, room_id)

    if permission is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this room",
        )

    return {
        "room_id": room_id,
        "user_id": current_user.id,
        "permission": permission.value,
    }


@router.get("/my-shared-rooms", response_model=List[RoomWithShares])
def get_my_shared_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל את כל החדרים המשותפים של המשתמש
    """
    # Get all rooms user can access (owned + shared)
    rooms = permission_service.get_user_rooms(db, current_user.id)

    result = []
    for room in rooms:
        # Get owner info
        owner = db.query(User).filter(User.id == room.owner_id).first()

        # Get shares (only if user is owner)
        shares = []
        if room.owner_id == current_user.id:
            shares_data = permission_service.get_room_shares(db, room.id)
            for share in shares_data:
                user = db.query(User).filter(User.id == share.user_id).first()
                shares.append(
                    RoomShareResponse(
                        id=share.id,
                        room_id=share.room_id,
                        user_id=share.user_id,
                        user_email=user.email if user else None,
                        user_name=user.full_name if user else None,
                        permission=share.permission,
                        shared_by=share.shared_by,
                        created_at=share.created_at,
                    )
                )

        result.append(
            RoomWithShares(
                id=room.id,
                name=room.name,
                user_id=room.owner_id,
                is_shared=room.is_shared,
                owner_email=owner.email if owner else None,
                owner_name=owner.full_name if owner else None,
                shares=shares,
            )
        )

    return result
