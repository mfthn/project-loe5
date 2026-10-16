"""Endpoint FastAPI untuk autentikasi pengguna."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ACCESS_TOKEN_EXPIRE_HOURS, create_access_token
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import Client, User, UserRole
from app.modules.auth.schemas import (
    ClientProfileResponse,
    LoginRequest,
    RegisterClientRequest,
    RegisterClientResponse,
    TokenResponse,
    UserCreateAdmin,
    UserResponse,
    UserUpdateAdmin,
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


@router.get("/clients", response_model=list[ClientProfileResponse])
def get_clients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ClientProfileResponse]:
    """Daftar klien untuk dropdown form. KLIEN_MAKLON hanya melihat miliknya."""
    from sqlalchemy import select

    from app.modules.auth.models import UserRole

    stmt = select(Client).order_by(Client.company_name)
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        stmt = stmt.where(Client.id == current_user.client_id)
    clients = list(db.scalars(stmt).all())
    return [
        ClientProfileResponse(
            id=c.id,
            company_name=c.company_name,
            contact_person=c.contact_person,
            phone_number=c.phone_number,
            client_code=c.client_code,
            created_at=c.created_at,
        )
        for c in clients
    ]


@router.get(
    "/users",
    response_model=list[UserResponse],
    dependencies=[Depends(require_roles([UserRole.OWNER]))],
)
def list_users(db: Session = Depends(get_db)) -> list[UserResponse]:
    """Owner melihat seluruh akun pekerja beserta peran & statusnya."""
    from sqlalchemy import select as _select

    users = list(db.scalars(_select(User).order_by(User.created_at.desc())).all())
    return [build_user_response(u, db) for u in users]


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles([UserRole.OWNER]))],
)
def create_user_by_owner(
    payload: UserCreateAdmin,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Owner membuat akun pekerja baru beserta otorisasi perannya."""
    from sqlalchemy import select as _select

    from app.core.security import hash_password

    if db.scalar(_select(User).where(User.username == payload.username.strip())):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{payload.username}' sudah dipakai.",
        )
    if payload.role == UserRole.KLIEN_MAKLON and not payload.client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Akun KLIEN_MAKLON wajib terhubung ke client_id.",
        )
    if payload.client_id and not db.get(Client, payload.client_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client tidak ditemukan."
        )
    user = User(
        username=payload.username.strip(),
        email=payload.email,
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
        client_id=payload.client_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return build_user_response(user, db)


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_roles([UserRole.OWNER]))],
)
def update_user_by_owner(
    user_id: uuid.UUID,
    payload: UserUpdateAdmin,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Owner mengedit akun: nama, peran/otorisasi, klien, status aktif."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.email is not None:
        user.email = payload.email
    if payload.role is not None:
        if payload.role == UserRole.KLIEN_MAKLON and not (payload.client_id or user.client_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Akun KLIEN_MAKLON wajib terhubung ke client_id.",
            )
        user.role = payload.role
    if payload.client_id is not None:
        if not db.get(Client, payload.client_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Client tidak ditemukan."
            )
        user.client_id = payload.client_id
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return build_user_response(user, db)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles([UserRole.OWNER]))],
)
def delete_user_by_owner(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Owner menghapus akun. Ditolak (409) bila akun punya riwayat transaksi —
    nonaktifkan saja lewat PATCH is_active=false."""
    from sqlalchemy.exc import IntegrityError

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Tidak dapat menghapus akun sendiri.",
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    db.delete(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Akun memiliki riwayat transaksi — nonaktifkan saja (is_active=false).",
        ) from None
    return None
