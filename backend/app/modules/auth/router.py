"""Endpoint FastAPI untuk autentikasi pengguna."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ACCESS_TOKEN_EXPIRE_HOURS, create_access_token
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    LoginRequest,
    RegisterClientRequest,
    RegisterClientResponse,
    TokenResponse,
    UserResponse,
)
from app.modules.auth.service import authenticate_user, register_client

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Login dengan username & password. Menghasilkan JWT dan menetapkan HttpOnly cookie."""
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah.",
        )

    claims = {
        "username": user.username,
        "role": user.role.value,
        "client_id": str(user.client_id) if user.client_id else None,
    }
    token = create_access_token(subject=str(user.id), claims=claims)

    # Tetapkan HttpOnly cookie untuk keamanan browser
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        samesite="lax",
        secure=False,  # Set True di production dengan HTTPS
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=RegisterClientResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterClientRequest,
    db: Session = Depends(get_db),
) -> RegisterClientResponse:
    """Registrasi mandiri klien maklon baru.

    Membuat record Client (perusahaan) dan User KLIEN_MAKLON secara atomik.
    Client ID yang dihasilkan menjadi PK yang digunakan di seluruh transaksi klien tersebut.
    """
    try:
        client, user = register_client(db, payload)
        db.commit()
        db.refresh(client)
        db.refresh(user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return RegisterClientResponse(
        message=(
            f"Registrasi berhasil! ID Klien Anda: {client.id}. "
            "Silakan login dengan username dan password yang telah dibuat."
        ),
        client_id=client.id,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    """Logout dan menghapus HttpOnly cookie sesi pengguna."""
    response.delete_cookie(key="access_token")
    return {"message": "Berhasil logout."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Mengambil data profil dan peran pengguna yang sedang login."""
    return UserResponse.model_validate(current_user)
