"""add fixed school classes

Revision ID: a1b2c3d4e5f6
Revises: 7acec800f80b
Create Date: 2026-02-25 11:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "7acec800f80b"
branch_labels = None
depends_on = None


FIXED_CLASSES = ["10-1", "10-2", "11-1", "11-2", "12-1", "12-2"]


def upgrade():
    op.create_table(
        "school_classes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    class_table = sa.table(
        "school_classes",
        sa.column("name", sa.String(length=50)),
    )
    op.bulk_insert(class_table, [{"name": class_name} for class_name in FIXED_CLASSES])

    op.execute("UPDATE users SET kelas = TRIM(kelas) WHERE kelas IS NOT NULL")
    op.execute("UPDATE users SET kelas = NULL WHERE kelas = ''")

    allowed_classes = ", ".join([f"'{class_name}'" for class_name in FIXED_CLASSES])
    op.execute(f"UPDATE users SET kelas = NULL WHERE kelas IS NOT NULL AND kelas NOT IN ({allowed_classes})")

    op.create_foreign_key(
        "fk_users_kelas_school_classes",
        "users",
        "school_classes",
        ["kelas"],
        ["name"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_users_kelas_school_classes", "users", type_="foreignkey")
    op.drop_table("school_classes")

