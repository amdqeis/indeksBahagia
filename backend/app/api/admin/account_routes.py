import csv
import io
from datetime import datetime

from flask import jsonify, request
from sqlalchemy import asc, desc, func, or_

from app.extentions import bcrypt, db
from .. import api
from ...constants import normalize_class_name
from ...models import User
from .core import (
    CSV_ALLOWED_COLUMNS,
    CSV_REQUIRED_COLUMNS,
    MAX_CSV_SIZE_BYTES,
    MAX_IMPORT_ROWS,
    get_admin_user,
    serialize_user,
    validate_account_fields,
    validate_password_strength,
)


@api.route("/admin/accounts", methods=["GET"])
def get_admin_accounts():
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

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
            "data": [serialize_user(user) for user in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    )


@api.route("/admin/accounts", methods=["POST"])
def create_admin_account():
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

    data = request.get_json() or {}
    fullname = (data.get("fullname") or "").strip()
    email = (data.get("email") or "").strip().lower()
    role = (data.get("role") or "").strip().lower()
    password = data.get("password")
    kode = (data.get("kode") or "").strip() or None
    kelas = normalize_class_name(data.get("kelas"))

    if password is None:
        return jsonify({"message": "password wajib diisi"}), 400

    validation_errors = validate_account_fields(fullname, email, role, kode, kelas)
    if validation_errors:
        return jsonify({"message": "Validasi akun gagal", "errors": validation_errors}), 400

    password_error = validate_password_strength(password)
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
        return jsonify({"message": "Akun berhasil dibuat", "data": serialize_user(user)}), 201
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal membuat akun: {error}"}), 500


@api.route("/admin/accounts/<int:user_id>", methods=["PUT"])
def update_admin_account(user_id):
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

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

    validation_errors = validate_account_fields(
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
        password_error = validate_password_strength(password_input)
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
        return jsonify({"message": "Akun berhasil diperbarui", "data": serialize_user(user)})
    except Exception as error:
        db.session.rollback()
        return jsonify({"message": f"Gagal memperbarui akun: {error}"}), 500


@api.route("/admin/accounts/<int:user_id>", methods=["DELETE"])
def delete_admin_account(user_id):
    is_allowed, admin_user, status = get_admin_user()
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
    is_allowed, admin_user, status = get_admin_user()
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
    is_allowed, admin_user, status = get_admin_user()
    if not is_allowed:
        return admin_user, status

    if admin_user.id == user_id:
        return jsonify({"message": "Reset password untuk akun sendiri tidak diizinkan dari menu ini"}), 400

    payload = request.get_json() or {}
    password = payload.get("password")
    if password is None:
        return jsonify({"message": "password wajib diisi"}), 400

    password_error = validate_password_strength(password)
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
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

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

        row_validation_errors = validate_account_fields(fullname, email, role, kode, kelas)
        if row_validation_errors:
            failed += 1
            errors.append({"row": row_index, "message": "; ".join(row_validation_errors)})
            continue

        password_error = validate_password_strength(password)
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
