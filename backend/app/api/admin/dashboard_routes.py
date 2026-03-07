from datetime import datetime, timedelta

from flask import jsonify
from sqlalchemy import func

from app.extentions import db
from .. import api
from ...models import User
from .core import get_admin_user


@api.route("/admin/dashboard", methods=["GET"])
def admin_dashboard_summary():
    is_allowed, payload, status = get_admin_user()
    if not is_allowed:
        return payload, status

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
