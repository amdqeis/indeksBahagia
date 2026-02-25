from flask import Blueprint, session, jsonify

api = Blueprint("api", __name__)
# Helper function to check if user is logged in
def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'message': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Import semua route file di sini agar otomatis terdaftar
from . import user, form, analytical, admin, dummy, table, auth
