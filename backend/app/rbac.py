from functools import wraps

from flask import g, jsonify, request, session

from .constants import is_valid_class_name, normalize_class_name
from .models import User, SchoolClass

ALL_CLASSES_SCOPE = "Semua Kelas"


def normalize_role(role):
    normalized = (role or "").strip().lower()
    if normalized == "superadmin":
        return "admin"
    if normalized == "user":
        return "siswa"
    return normalized


def normalize_requested_kelas(raw_value):
    normalized = normalize_class_name(raw_value)
    if not normalized:
        return None

    if normalized.lower() == ALL_CLASSES_SCOPE.lower():
        return ALL_CLASSES_SCOPE

    return normalized


def resolve_requested_kelas(class_arg="kelas", kwargs=None):
    kwargs = kwargs or {}

    if class_arg in kwargs:
        return kwargs.get(class_arg)

    view_args = request.view_args or {}
    if class_arg in view_args:
        return view_args.get(class_arg)

    query_value = request.args.get(class_arg)
    if query_value is not None:
        return query_value

    payload = request.get_json(silent=True) or {}
    if class_arg in payload:
        return payload.get(class_arg)

    return None


def get_user_allowed_classes(user):
    role = normalize_role(user.role)

    if role == "admin":
        return None

    if role == "guru":
        return {kelas for kelas in user.assigned_classes if is_known_class_name(kelas)}

    if role == "siswa":
        normalized_kelas = normalize_class_name(user.kelas)
        if normalized_kelas and is_known_class_name(normalized_kelas):
            return {normalized_kelas}
        return set()

    return set()


def is_known_class_name(kelas):
    if is_valid_class_name(kelas):
        return True
    return SchoolClass.query.filter(SchoolClass.name == kelas).first() is not None


def can_access_kelas(user, requested_kelas):
    role = normalize_role(user.role)

    if role == "admin":
        return True

    if requested_kelas == ALL_CLASSES_SCOPE:
        return False

    allowed_classes = get_user_allowed_classes(user)
    return requested_kelas in (allowed_classes or set())


def require_class_access(class_arg="kelas", allow_admin_all_scope=True):
    """
    Class-level RBAC decorator.

    Sets on flask.g:
    - current_user
    - current_role
    - requested_kelas
    - allowed_kelas
    """

    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user_id = session.get("user_id")
            if not user_id:
                return jsonify({"message": "Authentication required"}), 401

            current_user = User.query.get(user_id)
            if not current_user:
                return jsonify({"message": "User not found"}), 401

            role = normalize_role(current_user.role)
            if role not in {"admin", "guru", "siswa"}:
                return jsonify({"message": "Akses ditolak untuk role Anda"}), 403

            requested_kelas_raw = resolve_requested_kelas(class_arg=class_arg, kwargs=kwargs)
            requested_kelas = normalize_requested_kelas(requested_kelas_raw)

            if requested_kelas is None and role == "admin" and allow_admin_all_scope:
                requested_kelas = ALL_CLASSES_SCOPE

            if not requested_kelas:
                return jsonify({"message": "kelas wajib diisi"}), 400

            if requested_kelas != ALL_CLASSES_SCOPE and not is_known_class_name(requested_kelas):
                return jsonify({"message": "kelas tidak valid"}), 400

            if not can_access_kelas(current_user, requested_kelas):
                return jsonify({"message": "Forbidden: tidak diizinkan mengakses kelas ini"}), 403

            g.current_user = current_user
            g.current_role = role
            g.requested_kelas = requested_kelas
            g.allowed_kelas = get_user_allowed_classes(current_user)

            return fn(*args, **kwargs)

        return wrapped

    return decorator
