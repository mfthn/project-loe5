"""Endpoint FastAPI untuk autentikasi pengguna."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ACCESS_TOKEN_EXPIRE_HOURS, create_access_token
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import Client, User
from app.modules.auth.schemas import (
    ClientProfileResponse,
    LoginRequest,
    RegisterClientRequest,
    RegisterClientResponse,
    TokenResponse,
    UserResponse,
)
from app.modules.auth.service import authenticate_user, register_client

router = APIRouter(prefix="/auth", tags=["auth"])


def build_user_response(user: User, db: Session) -> UserResponse:
    """Helper untuk memetakan User ORM ke UserResponse lengkap dengan profil Client & Client Code 10 digit."""
    res = UserResponse.model_validate(user)
    if user.client_id:
        c_code = f"LOE-{str(user.client_id).replace('-', '')[:6].upper()}"
        res.client_code = c_code
        client = db.get(Client, user.client_id)
        if client:
            res.client = ClientProfileResponse(
                id=client.id,
                company_name=client.company_name,
                contact_person=client.contact_person,
                phone_number=client.phone_number,
                client_code=c_code,
                created_at=client.created_at,
            )
    return res


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
        user=build_user_response(user, db),
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

    client_code = f"LOE-{str(client.id).replace('-', '')[:6].upper()}"
    return RegisterClientResponse(
        message=(
            f"Registrasi berhasil! ID Klien Anda: {client_code}. "
            "Silakan login dengan username dan password yang telah dibuat."
        ),
        client_id=client.id,
        client_code=client_code,
        user=build_user_response(user, db),
    )


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    """Logout dan menghapus HttpOnly cookie sesi pengguna."""
    response.delete_cookie(key="access_token")
    return {"message": "Berhasil logout."}


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Mengambil data profil dan peran pengguna yang sedang login."""
    return build_user_response(current_user, db)
