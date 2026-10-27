"""Helper service untuk auth model lookup di manufacturing-service."""
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.modules.auth.models import User


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)
