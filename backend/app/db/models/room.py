"""Room-related models: Room, RoomShare"""
from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.task import Task
    from app.db.models.shopping_list import ShoppingList


class Room(Base):
    """Rooms in the house (living room, bedroom, etc.)"""
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)  # ex: "סלון", "חדר שינה"
    owner_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        backref="rooms",
        foreign_keys=[owner_id]
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="room",
        cascade="all, delete"
    )
    shared_with: Mapped[List["RoomShare"]] = relationship(
        "RoomShare",
        back_populates="room",
        cascade="all, delete"
    )
    shopping_lists: Mapped[List["ShoppingList"]] = relationship(
        "ShoppingList",
        back_populates="room",
        cascade="all, delete"
    )

    def __repr__(self) -> str:
        return f"<Room(id={self.id}, name='{self.name}', owner_id={self.owner_id})>"


class RoomShare(Base):
    """Room sharing with other users"""
    __tablename__ = "room_shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    permission: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="viewer"
    )  # owner, editor, viewer
    shared_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )  # who shared
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Unique constraint: user can only have one permission per room
    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="unique_room_user"),
    )

    # Relationships
    room: Mapped["Room"] = relationship("Room", back_populates="shared_with")
    user: Mapped["User"] = relationship(
        "User",
        back_populates="shared_rooms",
        foreign_keys=[user_id]
    )
    sharer: Mapped["User"] = relationship("User", foreign_keys=[shared_by])

    def __repr__(self) -> str:
        return f"<RoomShare(room_id={self.room_id}, user_id={self.user_id}, permission='{self.permission}')>"
