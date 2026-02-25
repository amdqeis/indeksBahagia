from app.extentions import db
from datetime import datetime

class Note(db.Model):
    __tablename__ = 'note'
    id              = db.Column(db.Integer, primary_key=True)
    date            = db.Column(db.DateTime, default=datetime.now)
    message         = db.Column(db.String, nullable=False)
    
    creator_id      = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    target_id       = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    # Relasi balik
    creator = db.relationship('User', foreign_keys=[creator_id], back_populates='notes_created')
    target = db.relationship('User', foreign_keys=[target_id], back_populates='notes_received')
    