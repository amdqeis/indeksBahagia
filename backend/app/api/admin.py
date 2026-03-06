import csv
import io
import re
from datetime import datetime, timedelta

from flask import jsonify, request, session
from sqlalchemy import asc, desc, func, or_

from app.extentions import bcrypt, db
from . import api
from ..models import User, SchoolClass
from ..constants import FIXED_CLASS_LIST, is_valid_class_name, normalize_class_name

ALLOWED_ROLES = {"admin", "guru", "user", "guest"}
CSV_REQUIRED_COLUMNS = {"fullname", "email", "role"}
CSV_ALLOWED_COLUMNS = {"fullname", "email", "role", "password", "kode", "kelas"}
MAX_IMPORT_ROWS = 1000
MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024
EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
KODE_REGEX = re.compile(r"^[A-Za-z0-9._-]+$")
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 72


def _get_fixed_classes():
    classes = [row.name for row in SchoolClass.query.order_by(SchoolClass.name).all()]
    return classes or FIXED_CLASS_LIST


def _is_valid_fixed_class(class_name):
    return class_name in set(_get_fixed_classes())


def _split_class_assignments(kelas):
    if kelas is None:
        return []
    if not isinstance(kelas, str):
        return []
    return [chunk.strip() for chunk in kelas.split(",") if chunk and chunk.strip()]


def _get_admin_user():
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


def _serialize_user(user: User):
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


def _validate_password_strength(password):
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


def _validate_account_fields(fullname, email, role, kode, kelas, enforce_role_class_consistency=True):
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
        assigned_classes = _split_class_assignments(kelas)
        if not assigned_classes:
            errors.append("kelas guru tidak valid")
        else:
            invalid_classes = [
                class_name
                for class_name in assigned_classes
                if not is_valid_class_name(class_name) or not _is_valid_fixed_class(class_name)
            ]
            if invalid_classes:
                errors.append(f"Kelas guru tidak valid: {', '.join(invalid_classes)}")

    if kelas is not None and role in {"user", "guest", "admin"}:
        if not is_valid_class_name(kelas) or not _is_valid_fixed_class(kelas):
            errors.append("Kelas tidak valid")

    return errors


@api.route("/admin/dashboard", methods=["GET"])
def admin_dashboard_summary():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    now = datetime.now()
    seven_days_ago = now - timedelta(days=7)

    total_accounts = db.session.query(func.count(User.id)).scalar() or 0
    total_admin = db.session.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    total_guru = db.session.query(func.count(User.id)).filter(User.role == "guru").scalar() or 0
    total_siswa = db.session.query(func.count(User.id)).filter(User.role == "user").scalar() or 0

    new_last_7_days = (
        db.session.query(func.count(User.id)).filter(User.created_at >= seven_days_ago).scalar() or 0
    )

    return jsonify(
        {
            "total_accounts": total_accounts,
            "total_admin": total_admin,
            "total_guru": total_guru,
            "total_siswa": total_siswa,
            "new_last_7_days": new_last_7_days,
        }
    )


@api.route("/admin/accounts", methods=["GET"])
def get_admin_accounts():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = max(1, min(100, request.args.get("per_page", 10, type=int) or 10))
    search = request.args.get("search", "", type=str)
    role = request.args.get("role", "", type=str)
    sort_by = request.args.get("sort_by", "created_at", type=str)
    sort_order = request.args.get("sort_order", "desc", type=str)

    sort_map = {
        "created_at": User.created_at,
        "updated_at": User.updated_at,
        "email": User.email,
        "fullname": User.fullname,
        "role": User.role,
    }
    sort_column = sort_map.get(sort_by, User.created_at)

    query = User.query

    if role:
        normalized_role = role.strip().lower()
        query = query.filter(func.lower(func.trim(User.role)) == normalized_role)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.fullname.ilike(search_term),
                User.email.ilike(search_term),
                User.kode.ilike(search_term),
            )
        )

    query = query.order_by(desc(sort_column) if sort_order == "desc" else asc(sort_column))

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "data": [_serialize_user(user) for user in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    )


@api.route("/admin/classes", methods=["GET"])
def get_admin_classes():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    rows = (
        db.session.query(SchoolClass.name.label("kelas"), func.count(User.id).label("total_siswa"))
        .outerjoin(User, (User.kelas == SchoolClass.name) & (func.lower(func.trim(User.role)) == "user"))
        .group_by(SchoolClass.name)
        .order_by(asc(SchoolClass.name))
        .all()
    )

    if not rows:
        return jsonify({"data": [{"kelas": class_name, "total_siswa": 0} for class_name in _get_fixed_classes()]})

    return jsonify(
        {
            "data": [
                {
                    "kelas": row.kelas,
                    "total_siswa": int(row.total_siswa or 0),
                }
                for row in rows
            ]
        }
    )


@api.route("/admin/classes/students", methods=["GET"])
def get_admin_students_by_class():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    source_class = normalize_class_name(request.args.get("source_class", "", type=str))
    if not source_class:
        return jsonify({"message": "source_class wajib diisi"}), 400
    if not is_valid_class_name(source_class) or not _is_valid_fixed_class(source_class):
        return jsonify({"message": "source_class tidak valid"}), 400

    students = (
        User.query.filter(func.lower(func.trim(User.role)) == "user", func.trim(User.kelas) == source_class)
        .order_by(asc(User.fullname))
        .all()
    )

    return jsonify({"data": [_serialize_user(student) for student in students], "total": len(students)})


@api.route("/admin/classes/move", methods=["POST"])
def move_students_class():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    data = request.get_json() or {}
    source_class = normalize_class_name(data.get("source_class"))
    target_class = normalize_class_name(data.get("target_class"))
    exclude_user_ids = data.get("exclude_user_ids") or []

    if not source_class or not target_class:
        return jsonify({"message": "source_class dan target_class wajib diisi"}), 400
    if (
        not is_valid_class_name(source_class)
        or not is_valid_class_name(target_class)
        or not _is_valid_fixed_class(source_class)
        or not _is_valid_fixed_class(target_class)
    ):
        return jsonify({"message": "source_class/target_class tidak valid"}), 400

    if source_class == target_class:
        return jsonify({"message": "Kelas asal dan kelas tujuan tidak boleh sama"}), 400

    if not isinstance(exclude_user_ids, list):
        return jsonify({"message": "exclude_user_ids harus berupa array"}), 400

    try:
        excluded_ids = {int(user_id) for user_id in exclude_user_ids}
    except (TypeError, ValueError):
        return jsonify({"message": "exclude_user_ids hanya boleh berisi angka id user"}), 400

    students_in_source = (
        User.query.filter(func.lower(func.trim(User.role)) == "user", func.trim(User.kelas) == source_class)
        .order_by(asc(User.fullname))
        .all()
    )

    if not students_in_source:
        return jsonify({"message": "Tidak ada siswa pada kelas asal yang dipilih"}), 404

    source_student_ids = {student.id for student in students_in_source}
    invalid_ids = sorted(excluded_ids - source_student_ids)
    if invalid_ids:
        return jsonify({"message": "Sebagian exclude_user_ids tidak valid untuk kelas asal", "invalid_ids": invalid_ids}), 400

    students_to_move = [student for student in students_in_source if student.id not in excluded_ids]
    if not students_to_move:
        return jsonify({"message": "Tidak ada siswa yang dipindahkan karena semua dikecualikan"}), 400

    now = datetime.now()
    for student in students_to_move:
        student.kelas = target_class
        student.updated_at = now

    try:
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal memindahkan kelas: {error}"}), 500

    return jsonify(
        {
            "message": "Pindah kelas massal berhasil",
            "source_class": source_class,
            "target_class": target_class,
            "total_source_students": len(students_in_source),
            "moved_count": len(students_to_move),
            "excluded_count": len(excluded_ids),
        }
    )


@api.route("/admin/accounts", methods=["POST"])
def create_admin_account():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    data = request.get_json() or {}
    fullname = (data.get("fullname") or "").strip()
    email = (data.get("email") or "").strip().lower()
    role = (data.get("role") or "").strip().lower()
    password = data.get("password")
    kode = (data.get("kode") or "").strip() or None
    kelas = normalize_class_name(data.get("kelas"))

    if password is None:
        return jsonify({"message": "password wajib diisi"}), 400

    validation_errors = _validate_account_fields(fullname, email, role, kode, kelas)
    if validation_errors:
        return jsonify({"message": "Validasi akun gagal", "errors": validation_errors}), 400

    password_error = _validate_password_strength(password)
    if password_error:
        return jsonify({"message": password_error}), 400

    existing_email = User.query.filter_by(email=email).first()
    if existing_email:
        return jsonify({"message": "Email sudah digunakan"}), 409

    if kode:
        existing_kode = User.query.filter_by(kode=kode).first()
        if existing_kode:
            return jsonify({"message": "Kode sudah digunakan"}), 409

    user = User(
        fullname=fullname,
        email=email,
        password_hash=bcrypt.generate_password_hash(password).decode("utf-8"),
        role=role,
        kode=kode,
        kelas=kelas,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    try:
        db.session.add(user)
        db.session.commit()
        return jsonify({"message": "Akun berhasil dibuat", "data": _serialize_user(user)}), 201
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal membuat akun: {error}"}), 500


@api.route("/admin/accounts/<int:user_id>", methods=["PUT"])
def update_admin_account(user_id):
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    fullname_input = data.get("fullname")
    email_input = data.get("email")
    role_input = data.get("role")
    password_input = data.get("password")
    kode_input = data.get("kode")
    kelas_input = data.get("kelas")

    normalized_fullname = user.fullname
    if fullname_input is not None:
        normalized_fullname = (fullname_input or "").strip()

    normalized_email = user.email
    if email_input is not None:
        normalized_email = (email_input or "").strip().lower()

    normalized_role = (user.role or "").strip().lower()
    if role_input is not None:
        normalized_role = (role_input or "").strip().lower()

    if kode_input is not None:
        normalized_kode = kode_input.strip() if isinstance(kode_input, str) else ""
        final_kode = normalized_kode or None
    else:
        final_kode = user.kode

    if kelas_input is not None:
        normalized_kelas = normalize_class_name(kelas_input)
    else:
        normalized_kelas = normalize_class_name(user.kelas)

    validation_errors = _validate_account_fields(
        normalized_fullname,
        normalized_email,
        normalized_role,
        final_kode,
        normalized_kelas,
        enforce_role_class_consistency=(role_input is not None or kelas_input is not None),
    )
    if validation_errors:
        return jsonify({"message": "Validasi akun gagal", "errors": validation_errors}), 400

    if password_input is not None and password_input != "":
        password_error = _validate_password_strength(password_input)
        if password_error:
            return jsonify({"message": password_error}), 400
        user.password_hash = bcrypt.generate_password_hash(password_input).decode("utf-8")

    existing_email = User.query.filter(User.email == normalized_email, User.id != user.id).first()
    if existing_email:
        return jsonify({"message": "Email sudah digunakan"}), 409

    if final_kode:
        existing_kode = User.query.filter(User.kode == final_kode, User.id != user.id).first()
        if existing_kode:
            return jsonify({"message": "Kode sudah digunakan"}), 409

    user.fullname = normalized_fullname
    user.email = normalized_email
    user.role = normalized_role
    user.kode = final_kode
    user.kelas = normalized_kelas

    user.updated_at = datetime.now()

    try:
        db.session.commit()
        return jsonify({"message": "Akun berhasil diperbarui", "data": _serialize_user(user)})
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal memperbarui akun: {error}"}), 500


@api.route("/admin/accounts/<int:user_id>", methods=["DELETE"])
def delete_admin_account(user_id):
    is_allowed, admin_user, status = _get_admin_user()
    if not is_allowed:
        return admin_user, status

    if admin_user.id == user_id:
        return jsonify({"message": "Anda tidak dapat menghapus akun sendiri"}), 400

    user = User.query.get_or_404(user_id)

    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "Akun berhasil dihapus"})
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal menghapus akun: {error}"}), 500


@api.route("/admin/accounts/bulk-delete", methods=["POST"])
def bulk_delete_admin_accounts():
    is_allowed, admin_user, status = _get_admin_user()
    if not is_allowed:
        return admin_user, status

    payload = request.get_json() or {}
    ids = payload.get("ids", [])
    if not isinstance(ids, list) or not ids:
        return jsonify({"message": "ids wajib berupa array dan tidak boleh kosong"}), 400

    try:
        ids_to_delete = sorted({int(user_id) for user_id in ids})
    except (TypeError, ValueError):
        return jsonify({"message": "ids hanya boleh berisi angka"}), 400

    if admin_user.id in ids_to_delete:
        return jsonify({"message": "Akun Anda sendiri tidak dapat dihapus"}), 400

    users_to_delete = User.query.filter(User.id.in_(ids_to_delete)).all()
    if not users_to_delete:
        return jsonify({"message": "Tidak ada akun yang dapat dihapus"}), 404

    deleted_ids = [user.id for user in users_to_delete]

    try:
        for user in users_to_delete:
            db.session.delete(user)
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal menghapus akun terpilih: {error}"}), 500

    return jsonify(
        {
            "message": f"{len(deleted_ids)} akun berhasil dihapus",
            "deleted_count": len(deleted_ids),
            "deleted_ids": deleted_ids,
        }
    )


@api.route("/admin/accounts/<int:user_id>/reset-password", methods=["POST"])
def reset_admin_account_password(user_id):
    is_allowed, admin_user, status = _get_admin_user()
    if not is_allowed:
        return admin_user, status

    if admin_user.id == user_id:
        return jsonify({"message": "Reset password untuk akun sendiri tidak diizinkan dari menu ini"}), 400

    payload = request.get_json() or {}
    password = payload.get("password")
    if password is None:
        return jsonify({"message": "password wajib diisi"}), 400

    password_error = _validate_password_strength(password)
    if password_error:
        return jsonify({"message": password_error}), 400

    user = User.query.get_or_404(user_id)
    user.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user.updated_at = datetime.now()

    try:
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal reset password: {error}"}), 500

    return jsonify(
        {
            "message": f"Password akun {user.fullname} berhasil direset",
            "user_id": user.id,
        }
    )


@api.route("/admin/accounts/import-csv", methods=["POST"])
def import_admin_accounts_csv():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status

    csv_file = request.files.get("file")
    if not csv_file:
        return jsonify({"message": "File CSV wajib diunggah"}), 400

    filename = (csv_file.filename or "").lower()
    if not filename.endswith(".csv"):
        return jsonify({"message": "Format file harus .csv"}), 400

    try:
        raw_content = csv_file.stream.read()
        if len(raw_content) > MAX_CSV_SIZE_BYTES:
            return jsonify({"message": f"Ukuran file maksimal {MAX_CSV_SIZE_BYTES // (1024 * 1024)} MB"}), 400
        content = raw_content.decode("utf-8-sig")
    except Exception:
        return jsonify({"message": "Gagal membaca file CSV. Pastikan encoding UTF-8"}), 400

    if not content.strip():
        return jsonify({"message": "File CSV kosong"}), 400

    reader = csv.DictReader(io.StringIO(content))
    headers = {header.strip() for header in (reader.fieldnames or []) if header}

    if not headers:
        return jsonify({"message": "Header CSV tidak ditemukan"}), 400

    if not CSV_REQUIRED_COLUMNS.issubset(headers):
        return (
            jsonify(
                {
                    "message": "Header CSV tidak valid",
                    "required": sorted(CSV_REQUIRED_COLUMNS),
                    "received": sorted(headers),
                }
            ),
            400,
        )

    unexpected_columns = sorted(headers - CSV_ALLOWED_COLUMNS)
    if unexpected_columns:
        return (
            jsonify(
                {
                    "message": "Header CSV mengandung kolom tidak dikenali",
                    "allowed": sorted(CSV_ALLOWED_COLUMNS),
                    "unexpected": unexpected_columns,
                }
            ),
            400,
        )

    imported = 0
    failed = 0
    errors = []

    existing_emails = {u.email.lower() for u in User.query.with_entities(User.email).all() if u.email}
    existing_kodes = {u.kode for u in User.query.with_entities(User.kode).all() if u.kode}
    seen_emails = set()
    seen_kodes = set()

    default_password = "ChangeMe123!"

    processed_rows = 0
    for row_index, row in enumerate(reader, start=2):
        is_empty_row = all((value or "").strip() == "" for value in row.values())
        if is_empty_row:
            continue

        if processed_rows >= MAX_IMPORT_ROWS:
            failed += 1
            errors.append({"row": row_index, "message": f"Melebihi batas maksimal {MAX_IMPORT_ROWS} baris"})
            continue
        processed_rows += 1

        fullname = (row.get("fullname") or "").strip()
        email = (row.get("email") or "").strip().lower()
        role = (row.get("role") or "").strip().lower()
        password = (row.get("password") or "").strip() or default_password
        kode = (row.get("kode") or "").strip() or None
        kelas = normalize_class_name(row.get("kelas"))

        row_validation_errors = _validate_account_fields(fullname, email, role, kode, kelas)
        if row_validation_errors:
            failed += 1
            errors.append({"row": row_index, "message": "; ".join(row_validation_errors)})
            continue

        password_error = _validate_password_strength(password)
        if password_error:
            failed += 1
            errors.append({"row": row_index, "message": password_error})
            continue

        if email in existing_emails or email in seen_emails:
            failed += 1
            errors.append({"row": row_index, "message": f"Email duplikat: {email}"})
            continue

        if kode and (kode in existing_kodes or kode in seen_kodes):
            failed += 1
            errors.append({"row": row_index, "message": f"Kode duplikat: {kode}"})
            continue

        user = User(
            fullname=fullname,
            email=email,
            password_hash=bcrypt.generate_password_hash(password).decode("utf-8"),
            role=role,
            kode=kode,
            kelas=kelas,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.session.add(user)

        seen_emails.add(email)
        if kode:
            seen_kodes.add(kode)
        imported += 1

    try:
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal import CSV: {error}"}), 500

    return jsonify({"message": "Import CSV selesai", "imported": imported, "failed": failed, "errors": errors})


@api.route("/admin/classes/fixed", methods=["GET"])
def get_fixed_classes():
    is_allowed, _, status = _get_admin_user()
    if not is_allowed:
        return _, status
    return jsonify({"data": _get_fixed_classes()})
