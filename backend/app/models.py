"""Import every model so Base.metadata knows all tables."""
from app.core.db import SchemaVersion  # noqa: F401
from app.modules.admissions.models import (  # noqa: F401
    Admission,
    AdmissionNote,
    ContactMessage,
)
from app.modules.auth.models import AuditLog, RefreshToken, User  # noqa: F401
from app.modules.content.models import (  # noqa: F401
    Certificate,
    Faq,
    Page,
    Partner,
    Post,
    Price,
    Teacher,
    Testimonial,
)
from app.modules.events.models import Tour, TourBooking  # noqa: F401
from app.modules.media.models import Album, Media  # noqa: F401
from app.modules.notifications.models import NotificationLog, SiteSetting  # noqa: F401

__all__ = [
    "SchemaVersion", "Admission", "AdmissionNote", "ContactMessage", "AuditLog", "RefreshToken", "User",
    "Certificate", "Faq", "Page", "Partner", "Post", "Price", "Teacher", "Testimonial", "Tour", "TourBooking",
    "Album", "Media", "NotificationLog", "SiteSetting",
]
