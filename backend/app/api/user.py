from flask_mail import Message, Mail
from . import api
from flask_bcrypt import Bcrypt
from flask import session, request, jsonify
from ..models import User, PasswordResetToken, SchoolClass
from datetime import datetime, timedelta
import secrets
import os
from app.extentions import db
from ..constants import FIXED_CLASS_LIST


bcrypt = Bcrypt()
mail = Mail()

def send_reset_email(user_email, url):
    """Send password reset email with a bright theme"""
    try:
        msg = Message(
            subject='🔐 Password Reset Request - Survey Ar Rafi',
            recipients=[user_email],
            html=f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #e0f7fa 0%, #fffde7 100%); padding: 20px; border-radius: 15px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #00796b; font-size: 2rem;">Survey Ar Rafi</h1>
                    <h2 style="color: #388e3c;">Reset Your Password</h2>
                </div>
                
                <div style="background: #ffffff; padding: 25px; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
                    <p style="color: #37474f; font-size: 1.1rem; line-height: 1.6;">
                        Hello! 👋
                    </p>
                    <p style="color: #37474f; line-height: 1.6;">
                        We received a request to reset your password for your SurveyArRafi account.
                        If you made this request, click the button below to reset your password:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{url}" style="
                            background: linear-gradient(45deg, #4db6ac, #81c784);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 25px;
                            font-weight: 600;
                            font-size: 1.1rem;
                            display: inline-block;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        ">🔓 Reset Password</a>
                    </div>
                    
                    <p style="color: #616161; line-height: 1.6; font-size: 0.9rem;">
                        ⏰ <strong>This link will expire in 1 hour</strong> for security reasons.
                    </p>
                    
                    <p style="color: #616161; line-height: 1.6; font-size: 0.9rem;">
                        If you didn't request this password reset, you can safely ignore this email.
                    </p>
                </div>
                
                <div style="text-align: center; color: #90a4ae; font-size: 0.8rem;">
                    <p>This is an automated message from Survey Ar Rafi</p>
                    <p>Please do not reply to this email</p>
                </div>
            </div>
            '''
        )

        mail.send(message=msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def send_create_account(user_email, url):
    """Send password reset email with a bright theme"""
    try:
        msg = Message(
            subject='🔐 Password Reset Request - Survey Ar Rafi',
            recipients=[user_email],
            html=f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #e0f7fa 0%, #fffde7 100%); padding: 20px; border-radius: 15px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #00796b; font-size: 2rem;">Survey Ar Rafi</h1>
                    <h2 style="color: #388e3c;">Reset Your Password</h2>
                </div>
                
                <div style="background: #ffffff; padding: 25px; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
                    <p style="color: #37474f; font-size: 1.1rem; line-height: 1.6;">
                        Hello! 👋
                    </p>
                    <p style="color: #37474f; line-height: 1.6;">
                        We received a request to reset your password for your SurveyArRafi account.
                        If you made this request, click the button below to reset your password:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{url}" style="
                            background: linear-gradient(45deg, #4db6ac, #81c784);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 25px;
                            font-weight: 600;
                            font-size: 1.1rem;
                            display: inline-block;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        ">🔓 Reset Password</a>
                    </div>
                    
                    <p style="color: #616161; line-height: 1.6; font-size: 0.9rem;">
                        ⏰ <strong>This link will expire in 1 hour</strong> for security reasons.
                    </p>
                    
                    <p style="color: #616161; line-height: 1.6; font-size: 0.9rem;">
                        If you didn't request this password reset, you can safely ignore this email.
                    </p>
                </div>
                
                <div style="text-align: center; color: #90a4ae; font-size: 0.8rem;">
                    <p>This is an automated message from Survey Ar Rafi</p>
                    <p>Please do not reply to this email</p>
                </div>
            </div>
            '''
        )

        mail.send(message=msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


@api.route('/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role
                }
            })
    
    return jsonify({'authenticated': False}), 401

@api.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    user = User.query.filter_by(email=email).first()
    
    if user and bcrypt.check_password_hash(user.password_hash, password):
        session.permanent = True
        session['user_id'] = user.id
        session['email'] = user.email
        session['role'] = user.role
        session['kelas'] = user.kelas
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'email': user.email,
                'role': user.role
            }
        })
    
    return jsonify({'message': 'Invalid credentials'}), 401

@api.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logout successful'})

@api.route('/access-classes', methods=['GET'])
def access_classes():
    role = session.get('role')
    kelas = session.get('kelas')
    
    if not role:
        return jsonify({'message': 'error'}), 400
    if role in ['admin', 'superadmin']:
        access = [row.name for row in SchoolClass.query.order_by(SchoolClass.name).all()]
        if not access:
            access = FIXED_CLASS_LIST

        
        kelasList = [
            {
                "label": k,
                "value": k
            }
            for k in access
        ]

        kelasList.insert(0, {"label": "Semua Kelas", "value": "Semua Kelas"})
        
        return jsonify(kelasList), 200
    
    if not kelas:
        return jsonify({'message': 'error'}), 400
    
    return jsonify([{
        'label': kelas,
        'value': kelas
    }]), 200

@api.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'Email not found'}), 404
    
    # Generate reset token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=24)
    
    # Use frontend URL
    frontend_url = os.getenv("FRONTEND_URL")
    reset_link = f"{frontend_url}/forgot-password?token={token}"
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at
    )
    db.session.add(reset_token)
    db.session.commit()
    
    if not send_reset_email(user_email=email, url=reset_link):
        return jsonify({
            'message': 'Gagal Terkirim'
        }), 400
    
    return jsonify({
        'message': 'Password reset token generated',
    })
    
@api.route('/reset-password', methods=['PUT'])
def reset_password():
    data = request.get_json()
    
    token = data.get('token')
    password = data.get('password')
    
    usedToken = PasswordResetToken.query.filter(PasswordResetToken.token == token).first()
    usedToken.used = True
    
    user = User.query.get(usedToken.user_id)
    user.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    db.session.commit()

    return jsonify({
        'message': 'Password berhasil diubah',
        'token': token,
        'password': password
    })

@api.route('/create-account', methods=['POST'])
def create_account():
    data = request.get_json()
    email = data.get('email')
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'Email not found'}), 404
    
    # Generate reset token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=168)
    
    # Use frontend URL
    frontend_url = os.getenv("FRONTEND_URL")
    reset_link = f"{frontend_url}/create-account?token={token}"
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at
    )
    db.session.add(reset_token)
    db.session.commit()
    
    if not send_create_account(user_email=email, url=reset_link):
        return jsonify({
            'message': 'Gagal Terkirim'
        }), 400
    
    return jsonify({
        'message': 'Password reset token generated',
        'token': token  # Remove this in production
    })
    
@api.route('/reset-account', methods=['PUT'])
def reset_account():
    data = request.get_json()
    
    token = data.get('token')
    password = data.get('password')
    
    usedToken = PasswordResetToken.query.filter(PasswordResetToken.token == token).first()
    usedToken.used = True
    
    user = User.query.get(usedToken.user_id)
    user.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    db.session.commit()

    return jsonify({
        'message': 'Password berhasil diubah',
        'token': token,
        'password': password
    })
