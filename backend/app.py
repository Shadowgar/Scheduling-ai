import os
from flask import Flask, jsonify
from config import Config
from models import db, Employee
from extensions import migrate, jwt, cors, setup_logging

# Import routes
from routes.auth import auth_bp
from routes.employee import employee_bp
from routes.shift import shift_bp
from routes.ollama import ollama_bp
from routes.policy import policy_bp
from routes.conversation import conversation_bp
from routes.schedule import schedule_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)
    setup_logging(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(employee_bp)
    app.register_blueprint(shift_bp)
    app.register_blueprint(ollama_bp)
    app.register_blueprint(policy_bp)
    app.register_blueprint(conversation_bp)
    app.register_blueprint(schedule_bp)
    
    # JWT user loader
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity_str = jwt_data["sub"]
        try:
            identity_int = int(identity_str)
        except ValueError:
            app.logger.warning(f"Invalid non-integer subject found in JWT: {identity_str}")
            return None
        return db.session.get(Employee, identity_int)
    
    # Global error handlers
    from flask_jwt_extended.exceptions import NoAuthorizationError, InvalidHeaderError, JWTDecodeError
    @app.errorhandler(NoAuthorizationError)
    def handle_no_auth_error(e):
        app.logger.error(f"NoAuthorizationError: {e}", exc_info=True)
        return jsonify({"error": "Missing or invalid authorization token"}), 401

    @app.errorhandler(InvalidHeaderError)
    def handle_invalid_header_error(e):
        app.logger.error(f"InvalidHeaderError: {e}", exc_info=True)
        return jsonify({"error": "Invalid authorization header"}), 422

    @app.errorhandler(JWTDecodeError)
    def handle_jwt_decode_error(e):
        app.logger.error(f"JWTDecodeError: {e}", exc_info=True)
        return jsonify({"error": "Invalid JWT token"}), 422

    @app.errorhandler(Exception)
    def handle_exception_error(e):
        app.logger.error(f"Unhandled Exception: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500
    
    # Root route
    @app.route('/')
    def index():
        return jsonify({"message": "Welcome to the Scheduling AI Backend!"})
    
    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't']
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')

    app.logger.info(f"Starting Flask server on {host}:{port} (Debug: {debug_mode})")
    app.run(debug=debug_mode, host=host, port=port)
