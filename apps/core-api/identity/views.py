import time
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from .aws_utils import get_active_rsa_keys
from .authentication import blacklist_token

def base64url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

class JWKSView(APIView):
    """
    Exposes the active Public Key in JWK format.
    Used by Clinic APIs to verify S2S JWTs and user JWTs.
    """
    permission_classes = [] # Public endpoint
    
    def get(self, request):
        _, public_pem, kid = get_active_rsa_keys()
        
        public_key = serialization.load_pem_public_key(public_pem)
        
        public_numbers = public_key.public_numbers()
        n = public_numbers.n
        e = public_numbers.e
        
        n_bytes = n.to_bytes((n.bit_length() + 7) // 8, byteorder='big')
        e_bytes = e.to_bytes((e.bit_length() + 7) // 8, byteorder='big')
        
        jwk = {
            "kty": "RSA",
            "kid": kid,
            "use": "sig",
            "alg": "RS256",
            "n": base64url_encode(n_bytes),
            "e": base64url_encode(e_bytes),
        }
        
        return JsonResponse({"keys": [jwk]})

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.CharField(required=False)
    username = serializers.CharField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'email_hash' in self.fields:
            self.fields['email_hash'].required = False

    def validate(self, attrs):
        email_val = attrs.get('email') or attrs.get('email_hash') or attrs.get('username')
        if not email_val:
            raise serializers.ValidationError({'email': 'Este campo es requerido.'})
        attrs['email_hash'] = str(email_val).strip().lower()
        return super().validate(attrs)

def get_portal_cookie_name(request):
    portal = request.headers.get('X-Portal-Type') or request.META.get('HTTP_X_PORTAL_TYPE') or 'default'
    if portal in ['patient', 'physician', 'clinic']:
        return f"refresh_{portal}_token"
    return "refresh_token"

class CookieTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            refresh_token = response.data.get('refresh')
            if refresh_token:
                cookie_name = get_portal_cookie_name(request)
                response.set_cookie(
                    cookie_name,
                    refresh_token,
                    max_age=24 * 60 * 60, # 1 day
                    httponly=True,
                    samesite='Lax',
                    secure=False, # Set to True in production with HTTPS
                )
                del response.data['refresh']
        return response

class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        cookie_name = get_portal_cookie_name(request)
        # Inject refresh token from cookie into request data for the serializer
        refresh_token = request.COOKIES.get(cookie_name) or request.COOKIES.get('refresh_token')
        if refresh_token:
            request.data['refresh'] = refresh_token
            
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            new_refresh_token = response.data.get('refresh')
            if new_refresh_token:
                response.set_cookie(
                    cookie_name,
                    new_refresh_token,
                    max_age=24 * 60 * 60,
                    httponly=True,
                    samesite='Lax',
                    secure=False,
                )
                del response.data['refresh']
        return response

class LogoutView(APIView):
    """
    Logs out the user by blacklisting their Refresh Token in Redis and deleting the cookie.
    """
    def post(self, request):
        cookie_name = get_portal_cookie_name(request)
        try:
            refresh_token = request.COOKIES.get(cookie_name) or request.COOKIES.get("refresh_token") or request.data.get("refresh")
            if not refresh_token:
                return Response({"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            token = RefreshToken(refresh_token)
            
            # SimpleJWT automatically verifies token. We extract JTI and EXP.
            jti = token.get('jti')
            exp = token.get('exp')
            
            if jti and exp:
                exp_seconds = int(exp) - int(time.time())
                blacklist_token(jti, exp_seconds)
                
            response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
            response.delete_cookie(cookie_name)
            response.delete_cookie("refresh_token")
            return response
        except TokenError as e:
            response = Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            response.delete_cookie(cookie_name)
            response.delete_cookie("refresh_token")
            return response

from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from .models import User, Roles, StaffProfile, PatientProfile, ClinicRegistry

class UserProfileView(APIView):
    """
    Returns and updates the currently authenticated user's profile.
    Supports personal info, medical credentials (cédula, especialidad) and password change.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = f"user_profile_{request.user.id}"
        data = cache.get(cache_key)

        if data is None:
            email = request.user.email_hash
            role = request.user.role.name if request.user.role else 'Desconocido'
            profile, _ = StaffProfile.objects.get_or_create(user=request.user)
            
            first_name = profile.first_name
            last_name = profile.last_name
            
            prefix = email.split('@')[0].capitalize()
            if first_name or last_name:
                full_name = f"{first_name} {last_name}".strip()
                initials = f"{first_name[:1]}{last_name[:1]}".upper() or prefix[:2].upper()
            else:
                full_name = f"Dr(a). {prefix}" if role == 'Radiólogo' else prefix
                initials = prefix[:2].upper()
                
            data = {
                "id": str(request.user.id),
                "email": email,
                "role": role,
                "name": full_name,
                "first_name": first_name,
                "last_name": last_name,
                "initials": initials,
                "phone": profile.phone,
                "cedula_profesional": profile.cedula_profesional,
                "specialty": profile.specialty,
                "bio": profile.bio,
                "avatar_url": request.user.avatar.url if request.user.avatar else "",
                "is_active": request.user.is_active
            }
            cache.set(cache_key, data, timeout=300) # 5 minutes cache

        return Response(data)

    def put(self, request):
        profile, _ = StaffProfile.objects.get_or_create(user=request.user)
        
        profile.first_name = request.data.get('first_name', profile.first_name)
        profile.last_name = request.data.get('last_name', profile.last_name)
        profile.phone = request.data.get('phone', profile.phone)
        profile.cedula_profesional = request.data.get('cedula_profesional', profile.cedula_profesional)
        profile.specialty = request.data.get('specialty', profile.specialty)
        profile.bio = request.data.get('bio', profile.bio)
        profile.save()

        # Handle Password Change if requested
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        if new_password:
            if current_password:
                if not request.user.check_password(current_password):
                    return Response({"error": "La contraseña actual es incorrecta."}, status=status.HTTP_400_BAD_REQUEST)
            request.user.set_password(new_password)
            request.user.save()
            
        cache.delete(f"user_profile_{request.user.id}")
        return self.get(request)

from rest_framework.parsers import MultiPartParser, FormParser

class UserAvatarUploadView(APIView):
    """
    Endpoint to upload a profile picture for the authenticated user.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request):
        file = request.FILES.get('avatar')
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        request.user.avatar = file
        request.user.save()
        return Response({
            "avatar_url": request.user.avatar.url if request.user.avatar else ""
        })

class ClinicUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = "clinic_users"
        data = cache.get(cache_key)
        
        if data is None:
            staff_roles = ['Radiólogo', 'Asistente Médico', 'Administrador', 'Superadministrador']
            users = User.objects.filter(role__name__in=staff_roles).select_related('role', 'staff_profile')
            data = []
            for u in users:
                role_name = u.role.name if u.role else 'Desconocido'
                profile = getattr(u, 'staff_profile', None)
                
                first_name = profile.first_name if profile else ''
                last_name = profile.last_name if profile else ''
                
                if first_name or last_name:
                    name = f"{first_name} {last_name}".strip()
                else:
                    prefix = u.email_hash.split('@')[0].capitalize()
                    name = f"Dr(a). {prefix}" if role_name == 'Radiólogo' else prefix

                data.append({
                    "id": str(u.id),
                    "email": u.email_hash,
                    "role": role_name,
                    "name": name,
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone": profile.phone if profile else '',
                    "cedula_profesional": profile.cedula_profesional if profile else '',
                    "specialty": profile.specialty if profile else '',
                    "is_active": u.is_active
                })
            cache.set(cache_key, data, timeout=300) # 5 minutes cache
            
        return Response({"users": data})
        
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        role_name = request.data.get('role')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        cedula = request.data.get('cedula_profesional', '')
        specialty = request.data.get('specialty', 'Radiología General')
        phone = request.data.get('phone', '')
        
        current_user_role = request.user.role.name if request.user.role else ''
        if current_user_role != 'Superadministrador' and role_name in ['Administrador', 'Superadministrador']:
            return Response({"error": "No tienes permisos para crear administradores"}, status=status.HTTP_403_FORBIDDEN)
        
        if not email or not password:
            return Response({"error": "Email and password are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        role = Roles.objects.filter(name=role_name).first()
        
        user = User.objects.create_user(email_hash=email, password=password, email_encrypted='enc_'+email)
        user.role = role
        user.save()

        StaffProfile.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            cedula_profesional=cedula,
            specialty=specialty,
            phone=phone
        )
        
        cache.delete("clinic_users")
        
        return Response({"status": "created", "id": str(user.id)}, status=status.HTTP_201_CREATED)

class ClinicUserDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def put(self, request, pk):
        current_user_role = request.user.role.name if request.user.role else ''
        try:
            user = User.objects.get(id=pk)
            target_role = user.role.name if user.role else ''
            
            if current_user_role != 'Superadministrador' and target_role in ['Administrador', 'Superadministrador']:
                return Response({"error": "No tienes permisos para modificar administradores"}, status=status.HTTP_403_FORBIDDEN)
            
            email = request.data.get('email')
            password = request.data.get('password')
            role_name = request.data.get('role')
            first_name = request.data.get('first_name')
            last_name = request.data.get('last_name')
            cedula = request.data.get('cedula_profesional')
            specialty = request.data.get('specialty')
            phone = request.data.get('phone')
            
            if role_name:
                if current_user_role != 'Superadministrador' and role_name in ['Administrador', 'Superadministrador']:
                    return Response({"error": "No tienes permisos para promover a este rol"}, status=status.HTTP_403_FORBIDDEN)
                role = Roles.objects.filter(name=role_name).first()
                if role:
                    user.role = role
                    
            if email:
                user.email_hash = email
                user.email_encrypted = 'enc_' + email
                
            if password:
                user.set_password(password)
                
            user.save()

            profile, _ = StaffProfile.objects.get_or_create(user=user)
            if first_name is not None:
                profile.first_name = first_name
            if last_name is not None:
                profile.last_name = last_name
            if cedula is not None:
                profile.cedula_profesional = cedula
            if specialty is not None:
                profile.specialty = specialty
            if phone is not None:
                profile.phone = phone
            profile.save()
            
            cache.delete("clinic_users")
            cache.delete(f"user_profile_{pk}")
            
            return Response({"status": "updated"}, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        current_user_role = request.user.role.name if request.user.role else ''
        try:
            user = User.objects.get(id=pk)
            target_role = user.role.name if user.role else ''
            
            if current_user_role != 'Superadministrador' and target_role in ['Administrador', 'Superadministrador']:
                return Response({"error": "No tienes permisos para eliminar administradores"}, status=status.HTTP_403_FORBIDDEN)
                
            user.delete()
            
            cache.delete("clinic_users")
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

class PatientListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patients = PatientProfile.objects.all().select_related('user')
        data = []
        for p in patients:
            data.append({
                "id": str(p.user.id),
                "patient_id": str(p.user.id),
                "first_name": p.first_name,
                "last_name": p.last_name,
                "curp_or_mrn": p.curp_or_mrn,
                "gender": p.gender,
                "dob": p.dob.isoformat() if p.dob else None
            })
        return Response({"patients": data})

class ClinicConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = "clinic_config"
        data = cache.get(cache_key)
        
        if data is None:
            clinic = ClinicRegistry.objects.first()
            if not clinic:
                return Response({"error": "Clinic not found"}, status=404)
            data = {
                "name": clinic.name,
                "primary_color": clinic.primary_color,
                "address": clinic.address,
                "phone": clinic.phone,
                "email": clinic.email,
                "rating": float(clinic.rating) if clinic.rating else 4.9,
                "specialties": clinic.specialties or [],
                "opening_hours": clinic.opening_hours,
                "latitude": clinic.latitude,
                "longitude": clinic.longitude,
                "report_layout": clinic.report_layout
            }
            cache.set(cache_key, data, timeout=300)
            
        return Response(data)
        
    def put(self, request):
        if not request.user.role or request.user.role.name != 'Superadministrador':
            return Response({"error": "Solo el Superadministrador puede modificar la clínica."}, status=403)
            
        clinic = ClinicRegistry.objects.first()
        if not clinic:
            return Response({"error": "Clinic not found"}, status=404)
            
        clinic.name = request.data.get('name', clinic.name)
        clinic.primary_color = request.data.get('primary_color', clinic.primary_color)
        clinic.address = request.data.get('address', clinic.address)
        clinic.phone = request.data.get('phone', clinic.phone)
        clinic.email = request.data.get('email', clinic.email)
        
        if 'rating' in request.data:
            try:
                clinic.rating = float(request.data['rating'])
            except (ValueError, TypeError):
                pass
                
        if 'specialties' in request.data and isinstance(request.data['specialties'], list):
            clinic.specialties = request.data['specialties']

        if 'opening_hours' in request.data:
            clinic.opening_hours = request.data['opening_hours']
            
        if 'latitude' in request.data and request.data['latitude'] is not None:
            try:
                clinic.latitude = float(request.data['latitude'])
            except (ValueError, TypeError):
                pass

        if 'longitude' in request.data and request.data['longitude'] is not None:
            try:
                clinic.longitude = float(request.data['longitude'])
            except (ValueError, TypeError):
                pass
                
        if 'report_layout' in request.data and isinstance(request.data['report_layout'], dict):
            clinic.report_layout = request.data['report_layout']

        clinic.save()

        # Invalidate patient clinics cache so the map updates instantly
        from django.core.cache import cache
        cache.delete('clinics_view_list')
        cache.delete('clinic_config')
        
        return Response({
            "name": clinic.name,
            "primary_color": clinic.primary_color,
            "address": clinic.address,
            "phone": clinic.phone,
            "email": clinic.email,
            "rating": float(clinic.rating),
            "specialties": clinic.specialties,
            "opening_hours": clinic.opening_hours,
            "latitude": clinic.latitude,
            "longitude": clinic.longitude
        }, status=status.HTTP_200_OK)

