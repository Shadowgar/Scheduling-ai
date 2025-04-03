from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import logging

# Initialize extensions
migrate = Migrate()
jwt = JWTManager()
cors = CORS()

# Configure logging
def setup_logging(app):
    logging.basicConfig(level=logging.INFO, 
                       format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    app.logger.setLevel(logging.INFO)