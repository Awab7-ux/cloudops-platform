"""Domain exceptions raised by application business operations."""


# Indicates that a requested application does not exist.
class NotFoundError(Exception):
    """Indicate that a requested domain resource was not found."""


# Indicates that an application operation conflicts with a domain constraint.
class ConflictError(Exception):
    """Indicate that a domain operation violates a uniqueness constraint."""
