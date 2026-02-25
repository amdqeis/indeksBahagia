from app.extentions import db

class SystemSetting(db.Model):
    __tablename__   = 'system_settings'
    id              = db.Column(db.Integer, primary_key=True)
    is_survey_harian_active = db.Column(db.Boolean, nullable=False, default=False)
    is_survey_mingguan_active = db.Column(db.Boolean, nullable=False, default=False)
