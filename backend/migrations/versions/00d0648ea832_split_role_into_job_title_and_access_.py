"""Split role into job_title and access_role

Revision ID: 00d0648ea832
Revises: 5e1f8fc8526e
Create Date: 2023-xx-xx xx:xx:xx.xxxx

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '00d0648ea832'
down_revision = '5e1f8fc8526e'
branch_labels = None
depends_on = None


def upgrade():
    # Create the new enum type first
    op.execute("CREATE TYPE accessroleenum AS ENUM ('supervisor', 'member')")
    
    # Add the new columns, allowing nulls initially
    op.add_column('employees', sa.Column('job_title', sa.String(length=100), nullable=True))
    op.add_column('employees', sa.Column('access_role', postgresql.ENUM('supervisor', 'member', name='accessroleenum', create_type=False), nullable=True))
    
    # Populate job_title from role
    op.execute("UPDATE employees SET job_title = role")
    
    # Populate access_role based on role
    op.execute("UPDATE employees SET access_role = CASE WHEN lower(role) = 'supervisor' THEN 'supervisor'::accessroleenum ELSE 'member'::accessroleenum END")
    
    # Make the new columns non-nullable now that they have data
    op.alter_column('employees', 'job_title', nullable=False)
    op.alter_column('employees', 'access_role', nullable=False, server_default='member')
    
    # Drop the old role column
    op.drop_column('employees', 'role')


def downgrade():
    # Add back the role column
    op.add_column('employees', sa.Column('role', sa.String(length=50), nullable=True))
    
    # Populate role from job_title (this is a best-effort restoration)
    op.execute("UPDATE employees SET role = job_title")
    
    # Make role non-nullable
    op.alter_column('employees', 'role', nullable=False)
    
    # Drop the new columns
    op.drop_column('employees', 'access_role')
    op.drop_column('employees', 'job_title')
    
    # Drop the enum type
    op.execute("DROP TYPE accessroleenum")