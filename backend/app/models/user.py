from app.extentions import db
from datetime import datetime, date, timedelta
import re
from sqlalchemy import func
from .record import RecordSiswaHarian, RecordSiswaMingguan
from .system_setting import SystemSetting

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    fullname = db.Column(db.String(100), unique=False, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='guest')
    kode = db.Column(db.String(50), unique=True, nullable=True)
    kelas = db.Column(db.String(50), db.ForeignKey('school_classes.name'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)
    
    # RelationShip
    harian = db.relationship('RecordSiswaHarian', backref='users', uselist=False, cascade='all, delete-orphan')
    notes_created = db.relationship(
        'Note',
        foreign_keys='Note.creator_id',
        back_populates='creator',
        cascade='all, delete-orphan'
    )

    notes_received = db.relationship(
        'Note',
        foreign_keys='Note.target_id',
        back_populates='target',
        cascade='all, delete-orphan'
    )

    @property
    def username(self):
        """
        Compatibility username field for API payloads.
        Uses email as canonical login identifier in this codebase.
        """
        return self.email

    @property
    def normalized_role(self):
        role = (self.role or "").strip().lower()
        if role == "superadmin":
            return "admin"
        if role == "user":
            return "siswa"
        return role

    @property
    def assigned_classes(self):
        """
        Returns normalized class list for RBAC.
        Supports single class ("8 Fatimah") and CSV class scope ("8 Fatimah,8 Hajar").
        """
        raw = (self.kelas or "").strip()
        if not raw:
            return []
        return [item.strip() for item in re.split(r"\s*,\s*", raw) if item and item.strip()]

    def to_identity_payload(self):
        return {
            "id": self.id,
            "username": self.username,
            "role": self.normalized_role,
            "kelas": self.kelas,
        }
    
    def has_filled_survey(self, tipe: str = "harian") -> bool:
        """Cek apakah user sudah mengisi survey berdasarkan tipe ('harian' / 'mingguan')."""
        today = date.today()

        if tipe == "harian":
            record = RecordSiswaHarian.query.filter(
                RecordSiswaHarian.user_id == self.id,
                func.date(RecordSiswaHarian.date) == today
            ).first()
        elif tipe == "mingguan":
            start_of_week = today - timedelta(days=today.weekday())  # Senin
            end_of_week = start_of_week + timedelta(days=6)
            record = RecordSiswaMingguan.query.filter(
                RecordSiswaMingguan.user_id == self.id,
                func.date(RecordSiswaMingguan.date).between(start_of_week, end_of_week)
            ).first()
        else:
            raise ValueError("Tipe survey tidak valid. Gunakan 'harian' atau 'mingguan'.")

        return record is not None
    
    def can_fill_survey(self, tipe: str = "harian"):
        """Cek apakah user boleh mengisi survey harian/mingguan."""

        setting = SystemSetting.query.first()

        # Kalau setting belum ada
        if not setting:
            return False, "Pengaturan survey belum diinisialisasi."

        # Cek tipe survey
        if tipe == "harian":
            is_active = setting.is_survey_harian_active
        elif tipe == "mingguan":
            is_active = setting.is_survey_mingguan_active
        else:
            raise ValueError("Tipe survey tidak valid. Gunakan 'harian' atau 'mingguan'.")

        # Cek apakah survey aktif
        if not is_active:
            return False, f"Survey {tipe} sedang tidak dibuka."

        # Cek apakah user sudah isi
        if self.has_filled_survey(tipe):
            return False, f"Kamu sudah mengisi survey {tipe}."

        return True, f"Kamu boleh mengisi survey {tipe}."
