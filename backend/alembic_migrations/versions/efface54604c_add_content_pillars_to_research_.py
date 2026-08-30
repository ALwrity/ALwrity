"""add_content_pillars_to_research_preferences

Revision ID: efface54604c
Revises: fb1c2d3e4f5a
Create Date: 2026-08-25 10:06:24.216386

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'efface54604c'
down_revision: Union[str, Sequence[str], None] = 'fb1c2d3e4f5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "research_preferences" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("research_preferences")]
        if "content_pillars" not in cols:
            op.add_column('research_preferences', sa.Column('content_pillars', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "research_preferences" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("research_preferences")]
        if "content_pillars" in cols:
            op.drop_column('research_preferences', 'content_pillars')
