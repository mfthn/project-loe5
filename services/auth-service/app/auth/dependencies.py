"""Dependency injection FastAPI untuk autentikasi dan penegakan RBAC (Role-Based Access Control)."""
import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.auth.models import User, UserRole
from app.auth.service import get_user_by_id

security_scheme = HTTPBearer(auto_error=False)


def get_token_from_request(
    request: Request,
    bearer: HTTPAuthorizationCredentials | None = Depends(security_scheme),
) -> str | None:
    """Mengambil JWT token dari Authorization header atau HttpOnly cookie."""
    if bearer and bearer.credentials:
        return bearer.credentials
    # Fallback ke cookie jika tidak ada header (misal request browser langsung)
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
    return None


def get_current_user(
    token: str | None = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> User:
    """Memverifikasi token dan mengembalikan pengguna aktif."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autentikasi diperlukan. Silakan login terlebih dahulu.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kedaluwarsa.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Format identitas token tidak valid.",
        )

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pengguna tidak ditemukan.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun pengguna dinonaktifkan.",
        )

    return user


def require_roles(allowed_roles: list[UserRole]) -> Callable[[User], User]:
    """Factory dependency untuk menegakkan RBAC di tingkat endpoint (server-side)."""

    def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            role_names = ", ".join(r.value for r in allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Endpoint ini hanya untuk peran: [{role_names}]. Peran Anda: {current_user.role.value}",
            )
        return current_user

    return _role_checker
