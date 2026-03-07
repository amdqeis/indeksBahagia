from datetime import datetime

from flask import jsonify, request
from sqlalchemy import asc, func

from app.extentions import db
from .. import api
from ...constants import is_valid_class_name, normalize_class_name
from ...models import SchoolClass, User
from .core import get_admin_user, get_fixed_classes_list, is_valid_fixed_class, serialize_user


@api.route("/admin/classes", methods=["GET"])
def get_admin_classes():
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

    rows = (
        db.session.query(SchoolClass.name.label("kelas"), func.count(User.id).label("total_siswa"))
        .outerjoin(User, (User.kelas == SchoolClass.name) & (func.lower(func.trim(User.role)) == "user"))
        .group_by(SchoolClass.name)
        .order_by(asc(SchoolClass.name))
        .all()
    )

    if not rows:
        return jsonify({"data": [{"kelas": class_name, "total_siswa": 0} for class_name in get_fixed_classes_list()]})

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
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

    source_class = normalize_class_name(request.args.get("source_class", "", type=str))
    if not source_class:
        return jsonify({"message": "source_class wajib diisi"}), 400
    if not is_valid_class_name(source_class) or not is_valid_fixed_class(source_class):
        return jsonify({"message": "source_class tidak valid"}), 400

    students = (
        User.query.filter(func.lower(func.trim(User.role)) == "user", func.trim(User.kelas) == source_class)
        .order_by(asc(User.fullname))
        .all()
    )

    return jsonify({"data": [serialize_user(student) for student in students], "total": len(students)})


@api.route("/admin/classes/move", methods=["POST"])
def move_students_class():
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

    data = request.get_json() or {}
    source_class = normalize_class_name(data.get("source_class"))
    target_class = normalize_class_name(data.get("target_class"))
    exclude_user_ids = data.get("exclude_user_ids") or []

    if not source_class or not target_class:
        return jsonify({"message": "source_class dan target_class wajib diisi"}), 400
    if (
        not is_valid_class_name(source_class)
        or not is_valid_class_name(target_class)
        or not is_valid_fixed_class(source_class)
        or not is_valid_fixed_class(target_class)
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


@api.route("/admin/classes/fixed", methods=["GET"])
def get_fixed_classes():
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status
    return jsonify({"data": get_fixed_classes_list()})
