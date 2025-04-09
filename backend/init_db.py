import os
from datetime import date
from flask import Flask
from models import db, Employee, AccessRole, EmployeeStatus
from werkzeug.security import generate_password_hash

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app

def seed_admin(app):
    with app.app_context():
        db.create_all()
        existing = Employee.query.filter_by(email='admin@example.com').first()
        if existing:
            print("Admin user already exists.")
            return
        admin = Employee(
            name='Admin User',
            email='admin@example.com',
            phone=None,
            job_title='Administrator',
            access_role=AccessRole.SUPERVISOR,
            hire_date=date.today(),
            status=EmployeeStatus.ACTIVE,
            password_hash=generate_password_hash('password123'),
            show_on_schedule=True
        )
        db.session.add(admin)
        db.session.commit()
        print("Admin user created: admin@example.com / password123")

if __name__ == "__main__":
    app = create_app()
    seed_admin(app)
