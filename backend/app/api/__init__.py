from flask import Blueprint, session, jsonify
from functools import wraps

api = Blueprint("api", __name__)
# Helper function to check if user is logged in
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'message': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Import semua route file di sini agar otomatis terdaftar
from . import user, form, analytical, admin, dummy, table, auth
