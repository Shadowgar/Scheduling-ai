# backend/migrations/versions/d5da9874c379_....py

"""Add auth fields (handle existing nulls), keep shift employee_id nullable

Revision ID: d5da9874c379
Revises: e3472b84c49a # Make sure this matches the previous revision
Create Date: ...
"""
from alembic import op
import sqlalchemy as sa
# --- Add import for password hashing ---
from werkzeug.security import generate_password_hash


# revision identifiers, used by Alembic.
revision = 'd5da9874c379'
down_revision = 'e3472b84c49a' # Make sure this matches the previous revision
branch_labels = None
depends_on = None

# --- Generate a placeholder hash ONCE ---
# !!! IMPORTANT: Users created with this MUST change their password !!!
placeholder_password = 'temporary_password_please_change'
placeholder_hash = generate_password_hash(placeholder_password)


def upgrade():
    # ### Manual multi-step upgrade ###

    # Step 1: Add password_hash and email columns as NULLABLE first
    print("Step 1: Adding/Altering columns (nullable)...") # Added print
    with op.batch_alter_table('employees', schema=None) as batch_op:
        batch_op.add_column(sa.Column('password_hash', sa.String(length=256), nullable=True))
        # Assume email existed but was nullable/not unique correctly
        batch_op.alter_column('email', existing_type=sa.VARCHAR(length=120), nullable=True)

    # Step 2: Update existing rows with placeholder hash and unique temporary email
    print("Step 2: Updating existing employees with placeholder password hash and temporary emails...") # Added print
    op.execute(f"UPDATE employees SET password_hash = '{placeholder_hash}' WHERE password_hash IS NULL")
    op.execute("UPDATE employees SET email = 'temp_' || id || '@example.com' WHERE email IS NULL OR email = ''") # Handle NULL or empty string

    # Step 3: Now make password_hash and email NOT NULL and add index/constraints
    print("Step 3: Making columns NOT NULL and handling constraints/index...") # Added print
    with op.batch_alter_table('employees', schema=None) as batch_op:
        batch_op.alter_column('password_hash', existing_type=sa.String(length=256), nullable=False)
        batch_op.alter_column('email', existing_type=sa.VARCHAR(length=120), nullable=False)

        # Handle unique constraint and index based on autodetect info:
        try:
            # Attempt to drop the old constraint if it exists (might fail harmlessly if already gone)
            batch_op.drop_constraint('employees_email_key', type_='unique')
            print("Dropped old constraint employees_email_key (if existed).")
        except Exception as e:
            print(f"Could not drop constraint employees_email_key (may not exist): {e}")

        # Create the desired index
        batch_op.create_index(batch_op.f('ix_employees_email'), ['email'], unique=True)

    # Step 4: Handle removed column from shifts table (if detected)
    print("Step 4: Handling removed columns...") # Added print
    with op.batch_alter_table('shifts', schema=None) as batch_op:
        try:
            batch_op.drop_column('role_required')
            print("Dropped column shifts.role_required.")
        except Exception as e:
            print(f"Could not drop shifts.role_required (may not exist): {e}")

    print("Upgrade d5da9874c379 complete.")
    # ### end Manual multi-step upgrade ###


def downgrade():
    # ### commands auto generated by Alembic - revise as needed ###
    # This downgrade needs to be the reverse of the manual upgrade.
    print("Running downgrade d5da9874c379 (may be incomplete)...") # Added print
    with op.batch_alter_table('shifts', schema=None) as batch_op:
        # Add back role_required if needed
        batch_op.add_column(sa.Column('role_required', sa.VARCHAR(length=100), autoincrement=False, nullable=True))

    with op.batch_alter_table('employees', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_employees_email'))
        # Add back old unique constraint if needed?
        # batch_op.create_unique_constraint('employees_email_key', ['email'])
        batch_op.alter_column('email',
               existing_type=sa.VARCHAR(length=120),
               nullable=True) # Make nullable again
        batch_op.drop_column('password_hash')

    print("Downgrade d5da9874c379 attempt finished.")
    # ### end Alembic commands ###