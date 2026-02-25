from app.extentions import db
from datetime import datetime

class RecordSiswaHarian(db.Model):
    __tablename__ = 'record_siswa_harian'
    id              = db.Column(db.Integer, primary_key=True)
    # Relationship
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    date            = db.Column(db.DateTime, default=datetime.now)
    bahagia         = db.Column(db.Integer, nullable=False)
    semangat        = db.Column(db.Integer, nullable=False)
    fokus           = db.Column(db.Integer, nullable=False)
    bertenaga       = db.Column(db.Integer, nullable=False)
    stress          = db.Column(db.Integer, nullable=False)
    dukungan_teman  = db.Column(db.Integer, nullable=False)
    dukungan_guru   = db.Column(db.Integer, nullable=False)
    aman            = db.Column(db.Integer, nullable=False)
    rasakan         = db.Column(db.String, nullable=True)
    
    skor           = db.Column(db.Float, nullable=False)
    
    __tableargs__ = db.UniqueConstraint('usre_id', 'date', name='unique_user_tanggal')
    
    def calculate_score(self):
        self.skor = (((
            (self.bahagia or 0) +
            (self.semangat or 0) +
            (self.fokus or 0) +
            (self.bertenaga or 0) +
            (6 - (self.stress or 0)) +
            (self.dukungan_teman or 0) +
            (self.dukungan_guru or 0) +
            (self.aman or 0)
        ) / 8 ) - 1) * 25
        return self.skor
    
class RecordSiswaMingguan(db.Model):
    __tablename__ = 'record_siswa_mingguan'
    id              = db.Column(db.Integer, primary_key=True)
    # Relationship
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    date            = db.Column(db.DateTime, default=datetime.now)
    bahagia         = db.Column(db.Integer, nullable=False)
    semangat        = db.Column(db.Integer, nullable=False)
    beban           = db.Column(db.Integer, nullable=False)
    cemas           = db.Column(db.Integer, nullable=False)
    bantuan_guru    = db.Column(db.Integer, nullable=False)
    menghargai      = db.Column(db.Integer, nullable=False)
    aman            = db.Column(db.Integer, nullable=False)
    bullying        = db.Column(db.Integer, nullable=True)
    desc_bullying   = db.Column(db.String, nullable=True)
    tidur           = db.Column(db.String, nullable=False)
    kehadiran       = db.Column(db.String, nullable=False)
    open_question   = db.Column(db.String(200), nullable=True)
    
    skor           = db.Column(db.Integer, nullable=False)
    
    __tableargs__ = db.UniqueConstraint('usre_id', 'date', name='unique_user_tanggal')
    
    def calculate_score(self):
        self.skor = (((
            (self.bahagia or 0) +
            (self.semangat or 0) +
            (6- (self.beban or 0)) +
            (6 - (self.cemas or 0)) +
            (self.bantuan_guru or 0) +
            (self.menghargai or 0) +
            (self.aman or 0)
        ) / 7 - 1)*25)
        return self.skor