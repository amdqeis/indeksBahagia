import re
from flask import jsonify, session

from app.extentions import db
from ...models import SchoolClass, User
from ...constants import FIXED_CLASS_LIST, is_valid_class_name

ALLOWED_ROLES = {"admin", "guru", "user", "guest"}
CSV_REQUIRED_COLUMNS = {"fullname", "email", "role"}
CSV_ALLOWED_COLUMNS = {"fullname", "email", "role", "password", "kode", "kelas"}
MAX_IMPORT_ROWS = 1000
MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024
EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
KODE_REGEX = re.compile(r"^[A-Za-z0-9._-]+$")
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 72


def get_fixed_classes_list():
    classes = [row.name for row in SchoolClass.query.order_by(SchoolClass.name).all()]
    return classes or FIXED_CLASS_LIST


def is_valid_fixed_class(class_name):
    return class_name in set(get_fixed_classes_list())


def split_class_assignments(kelas):
    if kelas is None:
        return []
    if not isinstance(kelas, str):
        return []
    return [chunk.strip() for chunk in kelas.split(",") if chunk and chunk.strip()]


def get_admin_user():
    user_id = session.get("user_id")
    role = session.get("role")

    if not user_id:
        return False, jsonify({"message": "Autentikasi diperlukan"}), 401

    if role != "admin":
        return False, jsonify({"message": "Akses hanya untuk admin"}), 403

    user = User.query.get(user_id)
    if not user or user.role != "admin":
        return False, jsonify({"message": "User admin tidak valid"}), 403

    return True, user, 200


def serialize_user(user: User):
    normalized_role = (user.role or "").strip().lower()
    return {
        "id": user.id,
        "fullname": user.fullname,
        "email": user.email,
        "role": normalized_role or "guest",
        "kode": user.kode,
        "kelas": user.kelas,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def validate_password_strength(password):
    if not isinstance(password, str):
        return "Password harus berupa teks"

    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password minimal {PASSWORD_MIN_LENGTH} karakter"

    if len(password) > PASSWORD_MAX_LENGTH:
        return f"Password maksimal {PASSWORD_MAX_LENGTH} karakter"

    if not re.search(r"[A-Z]", password):
        return "Password harus mengandung minimal 1 huruf besar"

    if not re.search(r"[a-z]", password):
        return "Password harus mengandung minimal 1 huruf kecil"

    if not re.search(r"[0-9]", password):
        return "Password harus mengandung minimal 1 angka"

    return None


def validate_account_fields(fullname, email, role, kode, kelas, enforce_role_class_consistency=True):
    errors = []

    if not fullname:
        errors.append("fullname wajib diisi")
    elif len(fullname) > 100:
        errors.append("fullname maksimal 100 karakter")

    if not email:
        errors.append("email wajib diisi")
    elif len(email) > 255:
        errors.append("email maksimal 255 karakter")
    elif not EMAIL_REGEX.match(email):
        errors.append("Format email tidak valid")

    if role not in ALLOWED_ROLES:
        errors.append("Role tidak valid")

    if kode:
        if len(kode) > 50:
            errors.append("kode maksimal 50 karakter")
        elif not KODE_REGEX.match(kode):
            errors.append("kode hanya boleh huruf, angka, titik, strip, atau underscore")

    if enforce_role_class_consistency:
        if role in {"user", "guru"} and not kelas:
            errors.append("kelas wajib diisi untuk role user/guru")

        if role in {"admin", "guest"} and kelas is not None:
            errors.append("kelas hanya boleh diisi untuk role user/guru")

    if kelas is not None and role == "guru":
        assigned_classes = split_class_assignments(kelas)
        if not assigned_classes:
            errors.append("kelas guru tidak valid")
        else:
            invalid_classes = [
                class_name
                for class_name in assigned_classes
                if not is_valid_class_name(class_name) or not is_valid_fixed_class(class_name)
            ]
            if invalid_classes:
                errors.append(f"Kelas guru tidak valid: {', '.join(invalid_classes)}")

    if kelas is not None and role in {"user", "guest", "admin"}:
        if not is_valid_class_name(kelas) or not is_valid_fixed_class(kelas):
            errors.append("Kelas tidak valid")

    return errors
