from flask_mail import Message, Mail
from app import app, db
from app.models import User
from app.models import PasswordResetToken
import secrets
from datetime import datetime, timedelta
import os

app.app_context().push()
mail = Mail()

def send_create_account(user_email, url):
    """Send password reset email with a bright theme"""
    try:
        msg = Message(
            subject='🔐 Pembuatan Akun Survey Ar Rafi',
            recipients=[user_email],
            html=f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #e0f7fa 0%, #fffde7 100%); padding: 20px; border-radius: 15px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #00796b; font-size: 2rem;">Survey Ar Rafi</h1>
                    <h2 style="color: #388e3c;">Aktivasi Akun</h2>
                </div>
                
                <div style="background: #ffffff; padding: 25px; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
                    <p style="color: #37474f; font-size: 1.1rem; line-height: 1.6;">
                        Hello! 👋
                    </p>
                    <p style="color: #37474f; line-height: 1.6;">
                        Silahkan Buat akun Anda dengan mengklik tombol di bawah ini.
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
                        ">🔓 Aktivasi Akun</a>
                    </div>
                    
                    <p style="color: #616161; line-height: 1.6; font-size: 0.9rem;">
                        ⏰ <strong>Link Pembuatan akun akan hangus dalam 168 jam</strong> untuk alasan keamanan.
                    </p>
                    
                    <p style="color: #616161; line-height: 1.6; font-size: 0.9rem;">
                        Jika Anda sudah membuat akun, Anda dapat mengabaikan email ini.
                    </p>
                </div>
                
                <div style="text-align: center; color: #90a4ae; font-size: 0.8rem;">
                    <p>Pesan ini merupakan pesan otomatis dari aplikasi Survey Ar Rafi</p>
                    <p>Mohon tidak membalas email ini</p>
                </div>
            </div>
            '''
        )

        mail.send(message=msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def createAcc(email):
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return "No email Found"
    
    
    
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
        return 'Gagal Terkirim'
    
    return 'Password reset token generated'

def makeAcc(nama, nis, email):
    user = User(
        fullname=nama,
        email=email,
        password_hash="masihkosong",
        role="guru",
        kode=nis,
        kelas=None
    )
    db.session.add(user)
    db.session.commit()
    return "User Created"

print(createAcc("ahmad.qeis122@gmail.com"))
