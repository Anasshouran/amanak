from django.contrib.auth import get_user_model
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .permissions import IsSuperAdmin, CanManageUser
from .serializers import (
    PasswordResetSerializer,
    UserCreateSerializer,
    UserReadSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["date_joined", "email", "last_login"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        qs = User.objects.prefetch_related("memberships__organization")
        scope = self.request.query_params.get("scope", "self")
        user = self.request.user

        if scope == "all":
            if not user.is_superuser:
                self.permission_denied(self.request, "scope=all requires super_admin")
        else:
            my_org_ids = user.memberships.values_list("organization_id", flat=True)
            qs = qs.filter(memberships__organization_id__in=my_org_ids).distinct()

        org_id = self.request.query_params.get("organization_id")
        if org_id:
            qs = qs.filter(memberships__organization_id=org_id).distinct()

        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(memberships__role=role).distinct()

        is_staff = self.request.query_params.get("is_staff")
        if is_staff is not None:
            qs = qs.filter(is_staff=is_staff.lower() == "true")

        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        if self.action == "reset_password":
            return PasswordResetSerializer
        return UserReadSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsSuperAdmin()]
        if self.action in ("update", "partial_update", "destroy", "reset_password"):
            return [IsAuthenticated(), CanManageUser()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        out = UserReadSerializer(user).data
        if hasattr(user, "_temp_password"):
            out["temp_password"] = user._temp_password
        return Response(out, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        ser = PasswordResetSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user.set_password(ser.validated_data["password"])
        user.save(update_fields=["password"])
        return Response({"detail": "password reset"})
