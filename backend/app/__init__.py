from flask import Flask
from .extentions import db, bcrypt, mail, migrate, cors

def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, origins=app.config['CORS_ORIGINS'], supports_credentials=app.config['CORS_SUPPORTS_CREDENTIALS'])

    from app import models

    # Register blueprints
    from .api import api
    app.register_blueprint(api, url_prefix='/api')

    # Initialize database
    @app.cli.command('init-db')
    def init_db():
        """Initialize the database."""
        from app.models import SystemSetting, SchoolClass, User
        from app.constants import FIXED_CLASS_LIST

        existing_classes = {row.name for row in SchoolClass.query.all()}
        for class_name in FIXED_CLASS_LIST:
            if class_name not in existing_classes:
                db.session.add(SchoolClass(name=class_name))

        if not SystemSetting.query.first():
            default_setting = SystemSetting(
                is_survey_harian_active=True,
                is_survey_mingguan_active=True
                )
            db.session.add(default_setting)

        admin_user = User.query.filter_by(email="admin").first()
        if not admin_user:
            admin_user = User(
                fullname="Administrator",
                email="admin",
                password_hash=bcrypt.generate_password_hash("admin123").decode("utf-8"),
                role="admin",
                kode="admin",
                kelas=None,
            )
            db.session.add(admin_user)

        db.session.commit()
        
        print("Database initialized.")

    return app
