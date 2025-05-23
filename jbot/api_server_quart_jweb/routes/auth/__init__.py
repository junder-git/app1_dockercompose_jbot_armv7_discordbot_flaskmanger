"""
Auth Blueprint for Quart Web Service
Handles authentication-related routes
"""
from quart import Blueprint

# Create blueprint
auth_blueprint = Blueprint('auth', __name__)

# Import routes
from .login_route import login_route
from .logout_route import logout_route
from .callback_route import callback_route

# Register routes with the blueprint
auth_blueprint.add_url_rule("/login", "login_route", login_route)
auth_blueprint.add_url_rule("/logout", "logout_route", logout_route)
auth_blueprint.add_url_rule("/callback", "callback_route", callback_route)