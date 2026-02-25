from . import api
from flask import request, jsonify
from ..models import PasswordResetToken
from datetime import datetime

@api.route('/validate-token', methods=['GET'])
def validate_token():
    token = request.args.get('token')
    if not token:
        return jsonify({'valid': False, 'message': 'Token diperlukan'}), 400

    reset_token = PasswordResetToken.query.filter_by(token=token).first()

    if not reset_token or reset_token.expires_at < datetime.now():
        return jsonify({'valid': False, 'message': 'Token tidak valid atau telah kedaluwarsa'}), 400
    
    if reset_token.used:
        return jsonify({'valid': False, 'message': 'Token telah digunakan'}), 400

    return jsonify({'valid': True, 'message': 'Token valid'}), 200