"""
Authentication Tests - 15+ test cases
Tests for: register, login, logout, token refresh, user management
"""
import pytest
from fastapi import status
from sqlalchemy.orm import Session
from app.db.models import User
from app.core.security import get_password_hash


class TestUserRegistration:
    """Tests for user registration endpoint"""
    
    @pytest.mark.auth
    def test_register_user_success(self, client, db: Session):
        """Test successful user registration returns tokens"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepassword123",
            }
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        # Registration endpoint returns Token, not User
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
    
    @pytest.mark.auth
    def test_register_returns_tokens_immediately(self, client, db: Session):
        """Test that registration returns access + refresh tokens immediately"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": f"token-test-{__import__('time').time()}@example.com",
                "password": "securepassword123",
            }
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        
        # Verify tokens are returned
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert isinstance(data["expires_in"], int)
        assert data["expires_in"] > 0
        
        # Verify tokens are not empty
        assert len(data["access_token"]) > 0
        assert len(data["refresh_token"]) > 0
    
    @pytest.mark.auth
    def test_register_then_verify_with_me_endpoint(self, client, db: Session):
        """
        Test complete flow: Register → GET /api/auth/me with token
        This verifies:
        1. Registration creates user in database
        2. Registration returns valid tokens
        3. Token works with /api/auth/me endpoint
        """
        test_email = f"me-test-{__import__('time').time()}@example.com"
        test_password = "securepassword123"
        
        # Step 1: Register user
        register_response = client.post(
            "/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
            }
        )
        assert register_response.status_code == status.HTTP_201_CREATED
        register_data = register_response.json()
        
        # Verify tokens are returned
        assert "access_token" in register_data
        assert "refresh_token" in register_data
        access_token = register_data["access_token"]
        refresh_token = register_data["refresh_token"]
        
        # Verify tokens are not empty
        assert len(access_token) > 0
        assert len(refresh_token) > 0
        
        # Step 2: Verify user was created in database
        from app.db.models import User
        user = db.query(User).filter(User.email == test_email).first()
        assert user is not None, "User should be created in database"
        assert user.email == test_email
        assert user.is_active is True
        
        # Step 3: Use access_token to call /api/auth/me
        me_response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert me_response.status_code == status.HTTP_200_OK
        me_data = me_response.json()
        
        # Verify /api/auth/me returns correct user data
        assert me_data["email"] == test_email
        assert me_data["id"] == user.id
        assert me_data["is_active"] is True
        assert "hashed_password" not in me_data  # Password should never be returned
        assert "password" not in me_data  # Password should never be returned
        
        # Verify token is valid and working
        assert me_data["id"] is not None
        assert isinstance(me_data["id"], int)
        
        print(f"✅ Registration successful: User ID {me_data['id']}, Email {me_data['email']}")
        print(f"✅ Token verification successful: /api/auth/me returned user data")
    
    @pytest.mark.auth
    def test_register_duplicate_email(self, client, test_user: User):
        """Test registration with existing email fails"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": test_user.email,
                "password": "anotherpassword123",
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already registered" in response.json()["detail"].lower()
    
    @pytest.mark.auth
    def test_register_invalid_email(self, client):
        """Test registration with invalid email format"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "invalid-email",
                "password": "securepassword123",
            }
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.auth
    def test_register_short_password(self, client):
        """Test registration with password shorter than minimum"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "user@example.com",
                "password": "short",  # Less than 8 characters
            }
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.auth
    def test_register_missing_fields(self, client):
        """Test registration with missing required fields"""
        response = client.post(
            "/api/auth/register",
            json={"email": "user@example.com"}  # Missing password
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUserLogin:
    """Tests for user login endpoint"""
    
    @pytest.mark.auth
    def test_login_success(self, client, test_user: User):
        """Test successful login"""
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user.email,
                "password": "testpassword123",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
    
    @pytest.mark.auth
    def test_login_wrong_password(self, client, test_user: User):
        """Test login with wrong password"""
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user.email,
                "password": "wrongpassword",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.auth
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent email"""
        response = client.post(
            "/api/auth/login",
            data={
                "username": "nonexistent@example.com",
                "password": "anypassword",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.auth
    def test_login_inactive_user(self, client, db: Session):
        """Test login with inactive user account"""
        # Create inactive user
        inactive_user = User(
            email="inactive@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=False,
        )
        db.add(inactive_user)
        db.commit()
        
        response = client.post(
            "/api/auth/login",
            data={
                "username": "inactive@example.com",
                "password": "password123",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestCurrentUser:
    """Tests for current user endpoint"""
    
    @pytest.mark.auth
    def test_get_current_user_authenticated(self, client, test_user: User, auth_headers):
        """Test getting current user when authenticated"""
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == test_user.email
        assert data["id"] == test_user.id
    
    @pytest.mark.auth
    def test_get_current_user_unauthenticated(self, client):
        """Test getting current user without authentication"""
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.auth
    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token"""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.auth
    def test_delete_current_user(self, client, test_user: User, auth_headers, db: Session):
        """Test soft-deleting current user account"""
        response = client.delete("/api/auth/me", headers=auth_headers)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify user is deactivated
        db.refresh(test_user)
        assert test_user.is_active == False
        assert "deleted_user" in test_user.email


class TestTokenRefresh:
    """Tests for token refresh endpoint"""
    
    @pytest.mark.auth
    def test_refresh_token_success(self, client, test_user: User):
        """Test successful token refresh"""
        # First login to get refresh token
        login_response = client.post(
            "/api/auth/login",
            data={
                "username": test_user.email,
                "password": "testpassword123",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        refresh_token = login_response.json()["refresh_token"]
        
        # Use refresh token
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
    
    @pytest.mark.auth
    def test_refresh_token_invalid(self, client):
        """Test refresh with invalid token"""
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid_refresh_token"}
        )
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST]


class TestLogout:
    """Tests for logout endpoints"""
    
    @pytest.mark.auth
    def test_logout_success(self, client, test_user: User):
        """Test successful logout (single device)"""
        # Login first
        login_response = client.post(
            "/api/auth/login",
            data={
                "username": test_user.email,
                "password": "testpassword123",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        tokens = login_response.json()
        
        # Logout
        response = client.post(
            "/api/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.auth
    def test_logout_all_devices(self, client, test_user: User):
        """Test logout from all devices"""
        # Login first
        login_response = client.post(
            "/api/auth/login",
            data={
                "username": test_user.email,
                "password": "testpassword123",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        tokens = login_response.json()
        
        # Logout all
        response = client.post(
            "/api/auth/logout-all",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        assert response.status_code == status.HTTP_200_OK
