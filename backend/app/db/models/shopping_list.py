# Shopping List Models
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from app.db.base import Base


class ShoppingList(Base):
    """
    Shopping List - רשימת קניות

    Represents a shopping list that can be reused.
    Users can create named lists (e.g., "Weekly Groceries", "Party Shopping")
    and reuse them multiple times.
    """
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(200), nullable=False)  # "רשימת קניות שבועית"
    description = Column(Text, nullable=True)
    is_template = Column(Boolean, default=False)  # If true, can be reused as template
    is_active = Column(Boolean, default=True)  # Currently active shopping trip
    reminder_time = Column(DateTime, nullable=True)  # Optional reminder for shopping
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    completed_at = Column(DateTime, nullable=True)  # When shopping was completed

    # Relationships
    user = relationship("User", back_populates="shopping_lists")
    room = relationship("Room", back_populates="shopping_lists")
    items = relationship("ShoppingItem", back_populates="shopping_list", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ShoppingList(id={self.id}, name='{self.name}', user_id={self.user_id})>"


class ShoppingItem(Base):
    """
    Shopping Item - פריט ברשימת קניות

    Individual item in a shopping list.
    """
    __tablename__ = "shopping_items"

    id = Column(Integer, primary_key=True, index=True)
    shopping_list_id = Column(Integer, ForeignKey("shopping_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)  # "חלב", "לחם", "ביצים"
    quantity = Column(String(50), nullable=True)  # "2 ליטר", "1 קילו", "6 יחידות"
    category = Column(String(100), nullable=True)  # "מוצרי חלב", "ירקות", "בשר"
    notes = Column(Text, nullable=True)  # "לקנות אורגני", "מבצע"
    is_checked = Column(Boolean, default=False)  # Checked off in store
    is_fixed = Column(Boolean, default=False)  # Fixed item in template (always appears)
    order = Column(Integer, default=0)  # Display order
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    checked_at = Column(DateTime, nullable=True)  # When item was checked

    # Relationships
    shopping_list = relationship("ShoppingList", back_populates="items")

    def __repr__(self):
        return f"<ShoppingItem(id={self.id}, name='{self.name}', checked={self.is_checked})>"
