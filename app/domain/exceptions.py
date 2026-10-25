"""Domain exceptions raised by application business operations."""

import logging

logger = logging.getLogger(__name__)


# Indicates that a requested application does not exist.
class NotFoundError(Exception):
    """Indicate that a requested domain resource was not found.

    Args:
        resource: Stable domain resource name used by the HTTP mapper.
    """

    # Stores the missing resource name on a domain exception.
    def __init__(self, resource: str = "application") -> None:
        """Initialize a not-found error for a domain resource.

        Args:
            resource: Stable domain resource name.
        """
        logger.debug(
            "NotFoundError.__init__ entry: resource_length=%d",
            len(resource),
        )
        super().__init__(resource)
        self.resource = resource
        logger.debug("NotFoundError.__init__ exit")


# Indicates that an application operation conflicts with a domain constraint.
class ConflictError(Exception):
    """Indicate that a domain operation violates a domain constraint.

    Args:
        detail: Stable detail code used by the HTTP mapper.
    """

    # Stores the conflict detail on a domain exception.
    def __init__(
        self,
        detail: str = "application name already exists",
    ) -> None:
        """Initialize a conflict error with a stable detail code.

        Args:
            detail: Stable detail code.
        """
        logger.debug(
            "ConflictError.__init__ entry: detail_length=%d",
            len(detail),
        )
        super().__init__(detail)
        self.detail = detail
        logger.debug("ConflictError.__init__ exit")
