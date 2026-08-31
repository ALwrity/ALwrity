"""add research_summary and social_media_citations to research_preferences

Revision ID: b0c1d2e3f4a5
Revises: c9d8e7f6a5b4
Create Date: 2026-08-29 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b0c1d2e3f4a5'
down_revision: Union[str, Sequence[str], None] = 'c9d8e7f6a5b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('research_preferences', sa.Column('research_summary', sa.JSON(), nullable=True))
    op.add_column('research_preferences', sa.Column('social_media_citations', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('research_preferences', 'social_media_citations')
    op.drop_column('research_preferences', 'research_summary')