"""User schemas for API validation and serialization"""
from __future__ import annotations
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime


class Token(BaseModel):
    """
    Response model for login/refresh/register endpoints
    
    IMPORTANT: All fields must match what the API returns.
    If there's a mismatch (e.g., expires_in_mins instead of expires_in),
    FastAPI will raise ValidationError.
    
    Fields:
    - access_token: str (required) - JWT access token
    - refresh_token: str (required) - JWT refresh token
    - token_type: str (default: "bearer") - Token type (OAuth2 standard)
    - expires_in: int (required) - Access token expiry in SECONDS (not minutes!)
    """
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type (OAuth2 standard)")
    expires_in: int = Field(..., description="Access token expiry in seconds (not minutes!)")


class RefreshTokenRequest(BaseModel):
    """Request model for token refresh"""
    refresh_token: str = Field(..., description="The refresh token to exchange for a new access token")


class UserBase(BaseModel):
    """Base schema for User"""
    email: EmailStr = Field(..., description="User email address")


class UserCreate(UserBase):
    """
    Schema for user registration
    
    Required fields:
    - email: EmailStr (required, validated as email format)
    - password: str (required, min 8 characters)
    
    Optional fields:
    - full_name: Optional[str] (optional, max 100 characters)
    
    FastAPI will return 422 if email or password are missing.
    If email is empty string, Pydantic validation will fail with 422.
    """
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")
    full_name: Optional[str] = Field(None, max_length=100, description="User's full name")


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class UserRead(UserBase):
    """Schema for reading user data"""
    id: int
    full_name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserInDB(UserRead):
    """Schema for user data as stored in DB (includes hashed password)"""
    hashed_password: str


class UserProfile(BaseModel):
    """Schema for user profile (public view)"""
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PasswordChange(BaseModel):
    """Schema for password change request"""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")
